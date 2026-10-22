import { describe, expect, it } from 'vitest'
import { approvalMode } from '../../src/core/approval'
import {
  buildContext,
  closingMessage,
  previousInputs,
  questionMode,
  type ContextInput,
} from '../../src/core/context'
import { createWork, taskDirName, taskId } from '../../src/core/machine'
import { PIPELINES } from '../../src/core/pipeline'
import { DEFAULT_CONFIG, type AppConfig, type WorkSettings } from '../../src/shared/config'
import type { NodeName } from '../../src/shared/contracts'
import type { TaskRecord, WorkState, WorkType } from '../../src/shared/work'

const WORK_DIR = 'C:\\Users\\u\\.relay\\projects\\my-api-3f9a1c\\works\\w-20260926-001'
const REQUEST = '로그인 직후 토큰이 만료된다.\n\n```\nError: token expired at 09:00\n```\n'
const INTENT = [
  '---',
  'schema_version: 1',
  'version: 1',
  'type: bugfix',
  '---',
  '## 목표',
  'KST 서버에서 토큰이 발급 직후 만료로 판정되는 문제를 고친다.',
  '',
].join('\n')
const DECISIONS =
  '## t-01 intake — 2026-09-26 10:05 (사람 승인)\n- [AI] 수정 위치는 둘 — 발급과 검증\n'
const PREV_HANDOFF = '---\nstatus: awaiting_approval\n---\n## 요약\n재현됨\n'

/** node task를 시작하려는 Work. 앞 단계는 모두 승인되어 있다 */
function workAt(
  node: NodeName,
  opts: { settings?: WorkSettings; type?: WorkType } = {},
): { work: WorkState; task: TaskRecord } {
  const type = opts.type ?? 'bugfix'
  const created = createWork({
    type,
    workId: 'w-20260926-001',
    baseBranch: 'main',
    baseCommit: '1a2b3c4d5e6f',
    ...(opts.settings ? { settings: opts.settings } : {}),
    at: '2026-09-26T10:00:00+09:00',
  }).work
  if (node === 'intake') return { work: created, task: created.tasks[0] as TaskRecord }
  const order = PIPELINES[type]
  const tasks = order.slice(0, order.indexOf(node) + 1).map((n, i) => ({
    ...(created.tasks[0] as TaskRecord),
    id: taskId(i + 1),
    seq: i + 1,
    node: n,
    status: n === node ? ('working' as const) : ('approved' as const),
  }))
  const work = { ...created, intent: { version: 1 }, tasks }
  return { work, task: tasks[tasks.length - 1] as TaskRecord }
}

/**
 * node task의 입력. 이전 task의 입력은 바로 앞 task(fix면 t-01 intake, verify면 t-02 fix)의 것이다.
 * intake의 intent 초안은 확정한 intent가 대신해 산출물에 넣지 않는다
 */
function input(node: NodeName, overrides: Partial<ContextInput> = {}, config?: AppConfig) {
  const { work, task } = workAt(node)
  const prev = work.tasks[work.tasks.length - 2]
  const base: ContextInput = {
    work,
    task,
    config: config ?? DEFAULT_CONFIG,
    taskDir: `${WORK_DIR}\\tasks\\${taskDirName(task)}`,
    draftsDir: `${WORK_DIR}\\work-drafts`,
    projectId: 'my-api-3f9a1c',
    request: { path: `${WORK_DIR}\\request.md`, text: REQUEST },
    intent: node === 'intake' ? null : INTENT,
    decisionLog: node === 'intake' ? '' : DECISIONS,
    rejected: prev
      ? [{ taskId: prev.id, node: prev.node, items: ['캐시 TTL 가설: 캐시를 끄고도 재현됨'] }]
      : [],
    previousHandoff: prev ? { taskId: prev.id, node: prev.node, text: PREV_HANDOFF } : null,
    artifacts:
      prev && prev.node !== 'intake'
        ? [
            {
              taskId: prev.id,
              node: prev.node,
              path: `${WORK_DIR}\\tasks\\${taskDirName(prev)}\\fix.md`,
            },
          ]
        : [],
  }
  return { ...base, ...overrides }
}

/** 코드 펜스 밖의 "## 제목" 절. 넣은 문서 안의 제목은 펜스 안에 있어 절이 아니다 */
function sections(md: string): Map<string, string> {
  const out = new Map<string, string[]>()
  let fence: string | null = null
  let current: string[] | undefined
  for (const line of md.split('\n')) {
    const mark = /^(`{3,})/.exec(line)?.[1]
    if (mark && (fence === null || (mark.length >= fence.length && line.trim() === mark))) {
      fence = fence === null ? mark : null
    } else if (fence === null && line.startsWith('## ')) {
      current = []
      out.set(line.slice(3), current)
      continue
    }
    current?.push(line)
  }
  return new Map([...out].map(([k, v]) => [k, v.join('\n').trim()]))
}

function section(md: string, title: string): string {
  const s = sections(md).get(title)
  if (s === undefined) throw new Error(`절 없음: ${title}\n${md}`)
  return s
}

describe('context.md: 시나리오 2-4 표의 항목', () => {
  const md = buildContext(input('verify'))

  it('task 정보: work_id, task_id, 프로젝트 id, node, skill, 승인된 intent 버전, task 디렉터리, 작업 브랜치, 기준 브랜치와 기준 커밋, Work 초안 폴더 (D97, D282, D421)', () => {
    expect(section(md, 'task 정보')).toBe(
      [
        '- work_id: w-20260926-001',
        '- task_id: t-03',
        '- 프로젝트 id: my-api-3f9a1c',
        '- 업무 유형: 버그 수정 (`bugfix`)',
        '- node: verify (리뷰와 검증)',
        '- skill: verify',
        '- 승인된 intent 버전: 1',
        `- task 디렉터리: ${WORK_DIR}\\tasks\\03-verify`,
        '- 작업 브랜치: relay/w-20260926-001',
        '- 기준 브랜치: main',
        '- 기준 커밋: 1a2b3c4d5e6f',
        `- Work 초안 폴더: ${WORK_DIR}\\work-drafts (근본부터 다시 하기로 사람과 정했을 때 새 Work의 초안을 쓰는 곳, D420)`,
      ].join('\n'),
    )
  })

  it('작업 브랜치는 work.json의 이름이고, 머지 대상을 골랐으면 함께 적는다 (D425, D428)', () => {
    const base = input('verify')
    const info = section(
      buildContext({
        ...base,
        work: { ...base.work, branch: 'fix/x-k7q2', target_branch: 'release' },
      }),
      'task 정보',
    )
    expect(info).toContain('- 작업 브랜치: fix/x-k7q2')
    expect(info).toContain('- 머지 대상 브랜치: release (PR의 base, D428)')
  })

  it('승인 방식과 마무리 안내 문구 (D104, D132)', () => {
    expect(section(md, '승인 방식')).toBe('수동 승인 (의도 승인, Work 완료는 늘 수동)')
    expect(section(md, '마무리 안내 문구')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만]을 누르세요. [이 단계 끝나면 멈춤]이 켜져 있으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.',
    )
  })

  it('질문 방식 (5.6.1)', () => {
    expect(section(md, '질문 방식')).toBe('초안 우선 (`draft_first`)')
  })

  it('선택 가능한 다음 단계 절은 없다: 파이프라인은 앞으로만 간다 (D418, D422)', () => {
    expect(sections(md).has('선택 가능한 다음 단계')).toBe(false)
    expect(md).not.toContain('recommended_next')
  })

  it('intent: 최신 승인 버전의 본문', () => {
    expect(section(md, 'intent (버전 1)')).toBe(`\`\`\`markdown\n${INTENT.trimEnd()}\n\`\`\``)
  })

  it('Work 요청 원문: intake가 아니면 경로만 (D34)', () => {
    expect(section(md, 'Work 요청 원문')).toBe(`경로: ${WORK_DIR}\\request.md`)
    expect(md).not.toContain('token expired')
  })

  it('결정 로그', () => {
    expect(section(md, '결정 로그')).toBe(`\`\`\`markdown\n${DECISIONS.trimEnd()}\n\`\`\``)
  })

  it('누적 기각 목록 (이전 handoff의 rejected)', () => {
    expect(section(md, '누적 기각 목록')).toBe('- t-02 fix: 캐시 TTL 가설: 캐시를 끄고도 재현됨')
    const multi = buildContext(
      input('verify', {
        rejected: [
          { taskId: 't-02', node: 'fix', items: ['첫 줄\n  둘째 줄', '다른 가설'] },
          { taskId: 't-03', node: 'verify', items: [] },
        ],
      }),
    )
    expect(section(multi, '누적 기각 목록')).toBe(
      '- t-02 fix: 첫 줄 둘째 줄\n- t-02 fix: 다른 가설',
    )
  })

  it('직전 handoff', () => {
    expect(section(md, '직전 handoff (t-02 fix)')).toBe(
      `\`\`\`markdown\n${PREV_HANDOFF.trimEnd()}\n\`\`\``,
    )
  })

  it('필요한 산출물: 경로만', () => {
    expect(section(md, '필요한 산출물')).toBe(`- t-02 fix: ${WORK_DIR}\\tasks\\02-fix\\fix.md`)
  })

  it('절의 순서. 넣은 문서의 제목은 코드 펜스 안에 있어 절과 섞이지 않는다', () => {
    expect([...sections(md).keys()]).toEqual([
      'task 정보',
      '승인 방식',
      '마무리 안내 문구',
      '질문 방식',
      'intent (버전 1)',
      'Work 요청 원문',
      '결정 로그',
      '누적 기각 목록',
      '직전 handoff (t-02 fix)',
      '필요한 산출물',
    ])
  })
})

describe('context.md: intake (처음)', () => {
  const md = buildContext(input('intake'))

  it('요청 원문을 본문으로 넣는다 (D34). 코드 펜스가 든 요청은 더 긴 펜스로 감싼다', () => {
    expect(section(md, 'Work 요청 원문')).toBe(
      `경로: ${WORK_DIR}\\request.md\n\n\`\`\`\`text\n${REQUEST.trimEnd()}\n\`\`\`\``,
    )
  })

  it('의도 승인 전이라 intent가 없다 (D227)', () => {
    expect(section(md, 'task 정보')).toContain('- 승인된 intent 버전: 없음 (의도 승인 전)')
    expect(section(md, 'intent')).toBe('없음 (의도 승인 전)')
    expect(md).not.toContain('size')
  })

  it('CRLF로 쓴 요청도 LF로 넣는다', () => {
    const crlf = buildContext(
      input('intake', { request: { path: 'r.md', text: REQUEST.replace(/\n/g, '\r\n') } }),
    )
    expect(section(crlf, 'Work 요청 원문')).toBe(
      section(
        buildContext(input('intake', { request: { path: 'r.md', text: REQUEST } })),
        'Work 요청 원문',
      ),
    )
    expect(crlf).not.toContain('\r')
  })

  it('비어 있는 항목은 "없음"이다', () => {
    for (const t of ['결정 로그', '누적 기각 목록', '직전 handoff', '필요한 산출물']) {
      expect(section(md, t)).toBe('없음')
    }
  })

  it('마무리 안내 문구의 [승인]은 [의도 승인]이다 (D104)', () => {
    expect(section(md, '마무리 안내 문구')).toContain('[의도 승인]을 누르세요')
  })
})

describe('context.md: fix (D228)', () => {
  const md = buildContext(input('fix'))

  it('task 정보: 노드 fix, 스킬 fix, 화면 이름 원인 분석과 수정', () => {
    expect(section(md, 'task 정보')).toContain('- task_id: t-02')
    expect(section(md, 'task 정보')).toContain('- node: fix (원인 분석과 수정)')
    expect(section(md, 'task 정보')).toContain('- skill: fix')
    expect(section(md, 'task 정보')).toContain(`- task 디렉터리: ${WORK_DIR}\\tasks\\02-fix`)
  })

  it('자동 승인은 기본으로 켜져 있다 (D214). 마무리 안내 문구는 수동과 자동을 한 문구에 적는다 (D132)', () => {
    expect(section(md, '승인 방식')).toBe(
      '자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)',
    )
    expect(section(md, '마무리 안내 문구')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.',
    )
  })

  it('이전 입력은 intake의 handoff다. intent 초안은 산출물로 넣지 않는다', () => {
    expect(section(md, '직전 handoff (t-01 intake)')).toBe(
      `\`\`\`markdown\n${PREV_HANDOFF.trimEnd()}\n\`\`\``,
    )
    expect(section(md, '필요한 산출물')).toBe('없음')
  })

  it('질문 방식은 fix 스킬의 설정이다', () => {
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      question_mode: { ...DEFAULT_CONFIG.question_mode, fix: 'confirm_each' },
    }
    expect(questionMode(config, {}, 'fix')).toBe('confirm_each')
    expect(section(buildContext(input('fix', {}, config)), '질문 방식')).toBe(
      '결정마다 확인 (`confirm_each`)',
    )
  })
})

describe('context.md: verify (D229)', () => {
  const md = buildContext(input('verify'))

  it('[승인]은 Work 완료 화면의 [완료만]이다 (D104)', () => {
    expect(section(md, '마무리 안내 문구')).toContain('[완료만]을 누르세요')
  })

  it('리뷰 전용 문구는 없다. 반영할 지적은 스킬 안에서 묻는다 (D229)', () => {
    expect(section(md, '마무리 안내 문구')).toBe(closingMessage('verify'))
    expect(section(md, '마무리 안내 문구')).not.toContain('지적')
    expect(section(md, '승인 방식')).not.toContain('지적')
  })

  it('질문 방식은 verify 스킬의 설정이다. 기본은 초안 우선이다 (5.1.1)', () => {
    expect(section(md, '질문 방식')).toBe('초안 우선 (`draft_first`)')
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      question_mode: { ...DEFAULT_CONFIG.question_mode, verify: 'confirm_each' },
    }
    expect(questionMode(config, {}, 'verify')).toBe('confirm_each')
    expect(section(buildContext(input('verify', {}, config)), '질문 방식')).toBe(
      '결정마다 확인 (`confirm_each`)',
    )
  })

  it('필요한 산출물에 fix의 fix.md 경로가 들어간다 (5.6.6)', () => {
    const T = `${WORK_DIR}\\tasks`
    const previous = previousInputs([
      { taskId: 't-01', node: 'intake', artifacts: [`${T}\\01-intake\\intent.draft.md`] },
      { taskId: 't-02', node: 'fix', artifacts: [`${T}\\02-fix\\fix.md`] },
    ])
    const text = section(buildContext(input('verify', previous)), '필요한 산출물')
    expect(text).toBe(`- t-02 fix: ${T}\\02-fix\\fix.md`)
  })
})

describe('마무리 안내 문구 (D104, D132)', () => {
  it('노드에 따라 고정 문구를 쓴다. 자동 승인을 켤 수 있는 단계는 수동과 자동을 한 문구에 적는다', () => {
    expect(closingMessage('fix')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.',
    )
    expect(closingMessage('intake')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [의도 승인]을 누르세요. 고칠 점은 여기에 말해 주세요.',
    )
    expect(closingMessage('verify')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만]을 누르세요. [이 단계 끝나면 멈춤]이 켜져 있으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.',
    )
  })

  it('verify는 Work 완료 화면에서 누를 수 있는 전달 버튼을 적는다 (D104, D67, D118)', () => {
    expect(closingMessage('verify', ['[완료만]', '[push]', '[PR 생성]'])).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push], [PR 생성] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.',
    )
    expect(closingMessage('verify', ['[완료만]', '[push]'])).toContain(
      '[완료만], [push] 중 하나를 누르세요',
    )
    expect(closingMessage('verify', ['[완료만]'])).toContain('[완료만]을 누르세요')
    // 다른 노드는 전달 버튼과 상관없다
    expect(closingMessage('fix', ['[완료만]', '[push]'])).toContain('[승인]을 누르세요')
    const md = buildContext({ ...input('verify'), delivery: ['[완료만]', '[push]', '[PR 생성]'] })
    expect(section(md, '마무리 안내 문구')).toContain(
      '[완료만], [push], [PR 생성] 중 하나를 누르세요',
    )
  })

  it('verify는 승인하면 멈출 때의 [승인하고 멈춤]도 적는다. 다른 노드는 [승인]뿐이다 (D119)', () => {
    // [이 단계 끝나면 멈춤]은 task가 도는 중에도 켜고 끌 수 있다
    for (const buttons of [[], ['[완료만]', '[push]'], ['[완료만]', '[push]', '[PR 생성]']]) {
      expect(closingMessage('verify', buttons)).toContain(
        '누르세요. [이 단계 끝나면 멈춤]이 켜져 있으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은',
      )
    }
    for (const node of ['intake', 'fix', 'respond'] as const) {
      expect(closingMessage(node)).not.toContain('[승인하고 멈춤]')
    }
    // 의도 승인과 Work 완료는 늘 수동이라 자동 승인을 적지 않는다 (4.2)
    for (const node of ['intake', 'verify'] as const) {
      expect(closingMessage(node)).not.toContain('자동 승인')
    }
    expect(closingMessage('fix')).toContain('자동 승인이 켜져 있으면')
    // 리뷰 전용 문구(반영할 지적을 번호로 말하라)는 없다 (D229)
    for (const node of ['intake', 'fix', 'verify', 'respond'] as const) {
      expect(closingMessage(node)).not.toContain('지적')
    }
  })

  it('승인 방식 절은 task를 시작할 때의 설정이다. 문구는 설정과 상관없이 같다 (D128, D132)', () => {
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      auto_approve: {
        fix: false,
        design: false,
        implement: false,
        refactor: false,
        spec: false,
        execute: false,
        respond: false,
      },
    }
    const md = buildContext(input('fix', {}, config))
    expect(section(md, '승인 방식')).toBe(
      '수동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)',
    )
    expect(section(md, '마무리 안내 문구')).toBe(closingMessage('fix'))
    expect(section(buildContext(input('fix')), '승인 방식')).toBe(
      '자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)',
    )
    expect(section(buildContext(input('fix')), '마무리 안내 문구')).toBe(closingMessage('fix'))
    expect(section(buildContext(input('intake', {}, config)), '승인 방식')).toBe(
      '수동 승인 (의도 승인, Work 완료는 늘 수동)',
    )
    expect(section(buildContext(input('verify', {}, config)), '승인 방식')).toBe(
      '수동 승인 (의도 승인, Work 완료는 늘 수동)',
    )
  })
})

describe('Work별 덮어쓰기 (D72)', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    auto_approve: {
      fix: true,
      design: false,
      implement: true,
      refactor: true,
      spec: true,
      execute: true,
      respond: true,
    },
    question_mode: { ...DEFAULT_CONFIG.question_mode, fix: 'confirm_each' },
  }

  it('Work 설정이 있으면 앱 설정보다 우선하고, 없는 키는 앱 설정을 따른다', () => {
    const settings: WorkSettings = {
      auto_approve: { fix: false },
      question_mode: { verify: 'confirm_each' },
    }
    expect(approvalMode(config, settings, 'fix')).toBe('manual')
    expect(approvalMode(config, settings, 'respond')).toBe('auto')
    expect(questionMode(config, settings, 'fix')).toBe('confirm_each')
    expect(questionMode(config, settings, 'verify')).toBe('confirm_each')
    expect(questionMode(config, settings, 'intake')).toBe('draft_first')
  })

  it('intake와 verify는 항상 수동이다. fix는 설정을 따른다 (4.2)', () => {
    expect(approvalMode(config, {}, 'intake')).toBe('manual')
    expect(approvalMode(config, {}, 'verify')).toBe('manual')
    expect(approvalMode(config, {}, 'fix')).toBe('auto')
    expect(approvalMode(DEFAULT_CONFIG, { auto_approve: { fix: false } }, 'fix')).toBe('manual')
  })

  it('context.md의 질문 방식은 Work 설정을 따른다', () => {
    const { work, task } = workAt('verify', {
      settings: { question_mode: { verify: 'confirm_each' } },
    })
    const md = buildContext({ ...input('verify'), work, task })
    expect(section(md, '질문 방식')).toBe('결정마다 확인 (`confirm_each`)')
  })
})

describe('이전 task의 입력 (시나리오 2-4, D89)', () => {
  const T = `${WORK_DIR}\\tasks`
  const handoff = (rejected: string) =>
    `---\nstatus: awaiting_approval\nrejected:\n${rejected}\n---\n## 요약\nx\n`

  it('기각 목록은 이전 모든 handoff의 rejected, 직전 handoff는 마지막 handoff다', () => {
    const r = previousInputs([
      {
        taskId: 't-01',
        node: 'intake',
        handoff: handoff('  []'),
        artifacts: [`${T}\\01-intake\\intent.draft.md`],
      },
      {
        taskId: 't-02',
        node: 'fix',
        handoff: handoff(
          '  - "캐시 TTL 가설: 캐시를 꺼도 재현됨"\n  - 3\n  - 가설: 따옴표 없으면 객체',
        ),
        artifacts: [`${T}\\02-fix\\fix.md`],
      },
      {
        taskId: 't-03',
        node: 'verify',
        handoff: '머리글 없음',
        artifacts: [`${T}\\03-verify\\verification.md`, `${T}\\03-verify\\notes.md`],
      },
    ])
    expect(r.rejected).toEqual([
      { taskId: 't-01', node: 'intake', items: [] },
      { taskId: 't-02', node: 'fix', items: ['캐시 TTL 가설: 캐시를 꺼도 재현됨'] },
      { taskId: 't-03', node: 'verify', items: [] },
    ])
    expect(r.previousHandoff).toEqual({ taskId: 't-03', node: 'verify', text: '머리글 없음' })
    // 산출물은 경로만. intake의 intent 초안은 확정한 intent가 대신한다
    expect(r.artifacts).toEqual([
      { taskId: 't-02', node: 'fix', path: `${T}\\02-fix\\fix.md` },
      { taskId: 't-03', node: 'verify', path: `${T}\\03-verify\\verification.md` },
      { taskId: 't-03', node: 'verify', path: `${T}\\03-verify\\notes.md` },
    ])
  })

  it('이전 task가 없으면 모두 비어 있다', () => {
    expect(previousInputs([])).toEqual({ rejected: [], previousHandoff: null, artifacts: [] })
  })
})

describe('context.md: 엔진별 승인 정책', () => {
  it('Codex fix/리뷰와 검증/PR 대응은 현재 기본 엔진과 관계없이 수동이며 카운트다운을 약속하지 않는다', () => {
    const config = {
      ...DEFAULT_CONFIG,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, fix: true, respond: true },
    }
    for (const node of ['fix', 'verify', 'respond'] as const) {
      const base = input('fix', {}, config)
      const md = buildContext({
        ...base,
        task: { ...base.task, node, engine: 'codex' },
        work: { ...base.work, settings: { auto_approve: { fix: true, respond: true } } },
      })
      expect(section(md, '승인 방식')).toContain('수동 승인 (Codex')
      expect(section(md, '마무리 안내 문구')).not.toContain('카운트다운')
      // verify는 [승인] 대신 Work 완료 화면의 전달 버튼이다
      expect(section(md, '마무리 안내 문구')).toContain(node === 'verify' ? '[완료만]' : '[승인]')
      if (node === 'respond')
        expect(section(md, '마무리 안내 문구')).toContain('push하고 답글을 게시')
    }
  })
  it('기본 엔진을 Codex로 바꿔도 시작해 둔 Claude task의 안내는 자동 승인 설정을 따른다', () => {
    const config = {
      ...DEFAULT_CONFIG,
      agent_engine: 'codex' as const,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, fix: true },
    }
    const md = buildContext(input('fix', {}, config))
    expect(section(md, '승인 방식')).toContain('자동 승인')
    expect(section(md, '마무리 안내 문구')).toContain('카운트다운')
  })
})

describe('context.md: 기능 추가 (D232, D236, D256)', () => {
  function featureInput(node: NodeName, overrides: Partial<ContextInput> = {}): ContextInput {
    const { work, task } = workAt(node, { type: 'feature' })
    return input('intake', {
      work,
      task,
      taskDir: `${WORK_DIR}\\tasks\\${taskDirName(task)}`,
      intent: node === 'intake' ? null : INTENT,
      ...overrides,
    })
  }

  it('task 정보에 업무 유형을 넣는다 (D236)', () => {
    const md = buildContext(featureInput('design'))
    expect(section(md, 'task 정보')).toContain('- 업무 유형: 기능 추가·변경 (`feature`)')
    expect(section(md, 'task 정보')).toContain('- node: design (설계와 계획)\n- skill: design')
  })

  it('design과 implement의 마무리 안내 문구는 fix와 같다. 승인 방식은 설정을 따른다 (D132, D234, D249)', () => {
    expect(closingMessage('design')).toBe(closingMessage('fix'))
    expect(closingMessage('implement')).toBe(closingMessage('fix'))
    expect(section(buildContext(featureInput('design')), '승인 방식')).toMatch(
      /^수동 승인 \(task를/,
    )
    expect(section(buildContext(featureInput('implement')), '승인 방식')).toMatch(
      /^자동 승인 \(task를/,
    )
  })
})

describe('context.md: 리팩터링 (D258, D278)', () => {
  function refactorInput(node: NodeName, overrides: Partial<ContextInput> = {}): ContextInput {
    const { work, task } = workAt(node, { type: 'refactor' })
    return input('intake', {
      work,
      task,
      taskDir: `${WORK_DIR}\\tasks\\${taskDirName(task)}`,
      intent: node === 'intake' ? null : INTENT,
      ...overrides,
    })
  }

  it('task 정보에 업무 유형과 refactor 스킬을 넣는다 (D261)', () => {
    const md = buildContext(refactorInput('refactor'))
    expect(section(md, 'task 정보')).toContain('- 업무 유형: 리팩터링 (`refactor`)')
    expect(section(md, 'task 정보')).toContain(
      '- node: refactor (계획과 리팩터링)\n- skill: refactor',
    )
  })

  it('refactor의 마무리 안내 문구는 fix와 같고 기본은 자동 승인이다 (D132, D276)', () => {
    expect(closingMessage('refactor')).toBe(closingMessage('fix'))
    expect(section(buildContext(refactorInput('refactor')), '승인 방식')).toMatch(
      /^자동 승인 \(task를/,
    )
  })
})

describe('context.md: 일반 (D302, D316, D318)', () => {
  function generalInput(node: NodeName, overrides: Partial<ContextInput> = {}): ContextInput {
    const { work, task } = workAt(node, { type: 'general' })
    return input('intake', {
      work,
      task,
      taskDir: `${WORK_DIR}\\tasks\\${taskDirName(task)}`,
      intent: node === 'intake' ? null : INTENT,
      ...overrides,
    })
  }

  it('task 정보에 업무 유형과 execute 스킬을 넣는다 (D303)', () => {
    const md = buildContext(generalInput('execute'))
    expect(section(md, 'task 정보')).toContain('- 업무 유형: 일반 (`general`)')
    expect(section(md, 'task 정보')).toContain('- node: execute (실행)\n- skill: execute')
  })

  it('execute의 마무리 안내 문구는 fix와 같고 기본은 자동 승인이다 (D132, D315)', () => {
    expect(closingMessage('execute')).toBe(closingMessage('fix'))
    expect(section(buildContext(generalInput('execute')), '승인 방식')).toMatch(
      /^자동 승인 \(task를/,
    )
  })
})

describe('context.md: 설계 (D350, D358, D365, D374)', () => {
  function specInput(node: NodeName, overrides: Partial<ContextInput> = {}): ContextInput {
    const { work, task } = workAt(node, { type: 'spec' })
    return input('intake', {
      work,
      task,
      taskDir: `${WORK_DIR}\\tasks\\${taskDirName(task)}`,
      intent: node === 'intake' ? null : INTENT,
      ...overrides,
    })
  }

  it('task 정보에 업무 유형과 spec 스킬을 넣는다 (D353, D372)', () => {
    const md = buildContext(specInput('spec'))
    expect(section(md, 'task 정보')).toContain('- 업무 유형: 설계 (`spec`)')
    expect(section(md, 'task 정보')).toContain('- node: spec (설계 문답)\n- skill: spec')
  })

  it('spec의 마무리 안내 문구는 fix와 같고 기본은 자동 승인이다 (D132, D367)', () => {
    expect(closingMessage('spec')).toBe(closingMessage('fix'))
    expect(section(buildContext(specInput('spec')), '승인 방식')).toMatch(/^자동 승인 \(task를/)
  })

  it('spec의 질문 방식 줄은 설정과 관계없이 결정마다 확인이다. 다른 단계는 설정을 따른다 (D358, I104)', () => {
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      question_mode: { ...DEFAULT_CONFIG.question_mode, verify: 'confirm_each' },
    }
    const line = '결정마다 확인 (`confirm_each`). 설계 문답은 결정을 모두 묻는다 (D358)'
    expect(questionMode(DEFAULT_CONFIG, {}, 'spec')).toBeNull()
    expect(section(buildContext(specInput('spec')), '질문 방식')).toBe(line)
    expect(section(buildContext(specInput('spec', { config })), '질문 방식')).toBe(line)
    expect(section(buildContext(specInput('verify')), '질문 방식')).toBe(
      '초안 우선 (`draft_first`)',
    )
  })
})

describe('context.md: 서브모듈 Work (D413, D414)', () => {
  it('메인 레포의 Work면 절이 없다', () => {
    expect(sections(buildContext(input('fix'))).has('서브모듈 Work')).toBe(false)
  })

  it('메인 통합 검증 worktree가 있으면 어디서 고치고 어디서 검증하는지, 하지 않을 것을 넣는다', () => {
    const md = buildContext(
      input('fix', {
        target: {
          main: 'app',
          path: 'lib',
          integration: { root: '/w/root', baseBranch: 'main', baseCommit: 'abc' },
        },
        submodules: ['vendor'],
      }),
    )
    const text = section(md, '서브모듈 Work')
    expect(text).toContain('메인 레포 `app`의 서브모듈 `lib`의 레포만 다룬다')
    expect(text).toContain('메인 레포의 통합 검증 worktree: `/w/root`')
    expect(text).toContain('`main`의 커밋 `abc`')
    expect(text).toContain('메인 레포의 파일은 고치지 않고')
    expect(text).toContain('`--checkout` 같은 옵션으로 `lib`를 갱신하지 않는다')
    // 서브모듈 레포 자신의 서브모듈 절(D383) 앞이다
    const titles = [...sections(md).keys()]
    expect(titles.indexOf('서브모듈 Work')).toBe(titles.indexOf('서브모듈') - 1)
  })

  it('메인 통합 검증 worktree가 없으면 서브모듈만으로 확인하고 못 한 것은 통과로 보지 않는다', () => {
    const text = section(
      buildContext(input('verify', { target: { main: 'app', path: 'lib', integration: null } })),
      '서브모듈 Work',
    )
    expect(text).toContain('통합 검증 worktree는 만들지 않았다')
    expect(text).toContain('통과로 보지 않고')
  })
})

describe('context.md: 서브모듈 (D383)', () => {
  it('서브모듈이 없으면 절이 없다', () => {
    expect(sections(buildContext(input('fix'))).has('서브모듈')).toBe(false)
    expect(sections(buildContext(input('fix', { submodules: [] }))).has('서브모듈')).toBe(false)
  })

  it('서브모듈이 있으면 받는 법과 하지 않을 것을 모든 단계에 넣는다', () => {
    for (const node of ['intake', 'fix', 'verify'] as const) {
      const md = buildContext(input(node, { submodules: ['lib', 'vendor/ui'] }))
      const text = section(md, '서브모듈')
      expect(text).toContain('이 레포에는 서브모듈이 있다: `lib`, `vendor/ui`.')
      expect(text).toContain('`git submodule update --init --recursive`로 받는다')
      expect(text).toContain('우회하지 않는다')
      expect(text).toContain('건너뛴 테스트를 통과로 보지 않는다')
      expect(text).toContain('서브모듈 안의 파일은 고치지 않는다')
      expect(text).toContain('`git submodule update --recursive`로 맞춘다')
      // 앱이 정하는 절 다음, intent 앞이다
      const titles = [...sections(md).keys()]
      expect(titles.indexOf('서브모듈')).toBe(titles.findIndex((t) => t.startsWith('intent')) - 1)
    }
  })
})
