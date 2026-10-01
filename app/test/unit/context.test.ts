import { describe, expect, it } from 'vitest'
import { approvalMode } from '../../src/core/approval'
import {
  buildContext,
  closingMessage,
  discardedAttempts,
  previousInputs,
  questionMode,
  type ContextInput,
  type SelectionInput,
} from '../../src/core/context'
import { createWork, taskDirName, taskId } from '../../src/core/machine'
import { route } from '../../src/core/pipeline'
import { DEFAULT_CONFIG, type AppConfig, type WorkSettings } from '../../src/shared/config'
import type { NodeName, Size } from '../../src/shared/contracts'
import type { TaskRecord, WorkState } from '../../src/shared/work'

const WORK_DIR = 'C:\\Users\\u\\.relay\\projects\\my-api-3f9a1c\\works\\w-20260926-001'
const REQUEST = '로그인 직후 토큰이 만료된다.\n\n```\nError: token expired at 09:00\n```\n'
const INTENT = [
  '---',
  'schema_version: 1',
  'version: 1',
  'type: bugfix',
  'size: L',
  '---',
  '## 목표',
  'KST 서버에서 토큰이 발급 직후 만료로 판정되는 문제를 고친다.',
  '',
].join('\n')
const DECISIONS =
  '## t-01 intake — 2026-09-26 10:05 (사람 승인)\n- [AI] 크기는 M — 수정 위치가 둘\n'
const PREV_HANDOFF = '---\nstatus: awaiting_approval\n---\n## 요약\n재현됨\n'

/** node task를 시작하려는 Work. 앞 단계는 모두 승인되어 있다 */
function workAt(
  node: NodeName,
  opts: { size?: Size; settings?: WorkSettings } = {},
): { work: WorkState; task: TaskRecord } {
  const size = opts.size ?? 'L'
  const created = createWork({
    workId: 'w-20260926-001',
    baseBranch: 'main',
    baseCommit: '1a2b3c4d5e6f',
    ...(opts.settings ? { settings: opts.settings } : {}),
    at: '2026-09-26T10:00:00+09:00',
  }).work
  if (node === 'intake') return { work: created, task: created.tasks[0] as TaskRecord }
  const nodes = route(size)
  const tasks = nodes.slice(0, nodes.indexOf(node) + 1).map((n, i) => ({
    ...(created.tasks[0] as TaskRecord),
    id: taskId(i + 1),
    seq: i + 1,
    node: n,
    status: n === node ? ('working' as const) : ('approved' as const),
  }))
  const work = { ...created, intent: { version: 1, size }, tasks }
  return { work, task: tasks[tasks.length - 1] as TaskRecord }
}

function input(
  node: NodeName,
  overrides: Partial<ContextInput> = {},
  config?: AppConfig,
  size?: Size,
) {
  const { work, task } = workAt(node, size ? { size } : {})
  const base: ContextInput = {
    work,
    task,
    config: config ?? DEFAULT_CONFIG,
    taskDir: `${WORK_DIR}\\tasks\\${taskDirName(task)}`,
    request: { path: `${WORK_DIR}\\request.md`, text: REQUEST },
    intent: node === 'intake' ? null : INTENT,
    decisionLog: node === 'intake' ? '' : DECISIONS,
    rejected:
      node === 'intake'
        ? []
        : [{ taskId: 't-02', node: 'evidence', items: ['캐시 TTL 가설: 캐시를 끄고도 재현됨'] }],
    previousHandoff:
      node === 'intake' ? null : { taskId: 't-02', node: 'evidence', text: PREV_HANDOFF },
    artifacts:
      node === 'intake'
        ? []
        : [
            {
              taskId: 't-02',
              node: 'evidence',
              path: `${WORK_DIR}\\tasks\\02-evidence\\evidence.md`,
            },
          ],
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
  const md = buildContext(input('rca'))

  it('task 정보: work_id, task_id, node, skill, 승인된 intent 버전, task 디렉터리, 기준 브랜치와 기준 커밋 (D97)', () => {
    expect(section(md, 'task 정보')).toBe(
      [
        '- work_id: w-20260926-001',
        '- task_id: t-03',
        '- node: rca (원인 분석)',
        '- skill: root-cause',
        '- 승인된 intent 버전: 1',
        `- task 디렉터리: ${WORK_DIR}\\tasks\\03-rca`,
        '- 기준 브랜치: main',
        '- 기준 커밋: 1a2b3c4d5e6f',
      ].join('\n'),
    )
  })

  it('승인 방식과 마무리 안내 문구 (D104, D132)', () => {
    expect(section(md, '승인 방식')).toBe(
      '수동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)',
    )
    expect(section(md, '마무리 안내 문구')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.',
    )
  })

  it('질문 방식 (5.6.1)', () => {
    expect(section(md, '질문 방식')).toBe('초안 우선 (`draft_first`)')
  })

  it('선택 가능한 다음 단계 (3.2)', () => {
    expect(section(md, '선택 가능한 다음 단계')).toBe(
      [
        '- 기본 다음 단계: fix (수정)',
        '- 이전 단계: intake (의도 정리), evidence (재현과 관찰)',
      ].join('\n'),
    )
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
    expect(section(md, '누적 기각 목록')).toBe(
      '- t-02 evidence: 캐시 TTL 가설: 캐시를 끄고도 재현됨',
    )
    const multi = buildContext(
      input('rca', {
        rejected: [
          { taskId: 't-02', node: 'evidence', items: ['첫 줄\n  둘째 줄', '다른 가설'] },
          { taskId: 't-03', node: 'rca', items: [] },
        ],
      }),
    )
    expect(section(multi, '누적 기각 목록')).toBe(
      '- t-02 evidence: 첫 줄 둘째 줄\n- t-02 evidence: 다른 가설',
    )
  })

  it('직전 handoff', () => {
    expect(section(md, '직전 handoff (t-02 evidence)')).toBe(
      `\`\`\`markdown\n${PREV_HANDOFF.trimEnd()}\n\`\`\``,
    )
  })

  it('필요한 산출물: 경로만', () => {
    expect(section(md, '필요한 산출물')).toBe(
      `- t-02 evidence: ${WORK_DIR}\\tasks\\02-evidence\\evidence.md`,
    )
  })

  it('절의 순서. 넣은 문서의 제목은 코드 펜스 안에 있어 절과 섞이지 않는다', () => {
    expect([...sections(md).keys()]).toEqual([
      'task 정보',
      '승인 방식',
      '마무리 안내 문구',
      '질문 방식',
      '선택 가능한 다음 단계',
      'intent (버전 1)',
      'Work 요청 원문',
      '결정 로그',
      '누적 기각 목록',
      '직전 handoff (t-02 evidence)',
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

  it('의도 승인 전이라 intent가 없고, 기본 다음 단계는 size에 따른다', () => {
    expect(section(md, 'task 정보')).toContain('- 승인된 intent 버전: 없음 (의도 승인 전)')
    expect(section(md, 'intent')).toBe('없음 (의도 승인 전)')
    expect(section(md, '선택 가능한 다음 단계')).toBe(
      [
        '- 기본 다음 단계: 의도 승인 뒤 size에 따라 S이면 fix (수정), M이면 investigate (재현과 원인 분석), L이면 evidence (재현과 관찰)',
        '- 이전 단계: 없음',
      ].join('\n'),
    )
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

describe('context.md: M 경로 (D147, D149)', () => {
  const at = (node: NodeName, config?: AppConfig) => buildContext(input(node, {}, config, 'M'))

  it('investigate: 스킬은 investigate, 기본 다음 단계는 fix, 이전 단계는 intake', () => {
    const md = at('investigate')
    expect(section(md, 'task 정보')).toContain('- node: investigate (재현과 원인 분석)')
    expect(section(md, 'task 정보')).toContain('- skill: investigate')
    expect(section(md, '선택 가능한 다음 단계')).toBe(
      ['- 기본 다음 단계: fix (수정)', '- 이전 단계: intake (의도 정리)'].join('\n'),
    )
  })

  it('fix의 이전 단계에는 evidence와 rca 대신 investigate가 있다. 기본 다음 단계는 review다 (D166)', () => {
    expect(section(at('fix'), '선택 가능한 다음 단계')).toBe(
      [
        '- 기본 다음 단계: review (리뷰)',
        '- 이전 단계: intake (의도 정리), investigate (재현과 원인 분석)',
      ].join('\n'),
    )
  })

  it('investigate는 자동 승인을 켤 수 있고 질문 방식은 investigate 스킬의 설정이다 (D151)', () => {
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, investigate: true },
      question_mode: { ...DEFAULT_CONFIG.question_mode, investigate: 'confirm_each' },
    }
    expect(approvalMode(config, {}, 'investigate')).toBe('auto')
    expect(approvalMode(DEFAULT_CONFIG, {}, 'investigate')).toBe('manual')
    expect(questionMode(config, {}, 'investigate')).toBe('confirm_each')
    expect(closingMessage('investigate')).toBe(closingMessage('rca'))
  })
})

describe('context.md: review (D163~D166, D213)', () => {
  const REVIEW_CLOSING =
    '리뷰를 썼습니다. 반영할 지적은 번호로 여기에 말해 주세요. 반영할 것이 없거나 반영을 마쳤으면 오른쪽 패널에서 확인하고 [승인]을 누르세요. 지적이 없고 자동 승인이 켜져 있으면 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요.'

  it('task 정보: 노드 review, 스킬 review, 화면 이름 리뷰 (D187)', () => {
    const md = buildContext(input('review'))
    expect(section(md, 'task 정보')).toContain('- node: review (리뷰)')
    expect(section(md, 'task 정보')).toContain('- skill: review')
    expect(section(md, 'task 정보')).toContain(`- task 디렉터리: ${WORK_DIR}\\tasks\\05-review`)
  })

  it('마무리 안내 문구는 리뷰의 고정 문구다 (시나리오 2-4의 review 줄)', () => {
    expect(closingMessage('review')).toBe(REVIEW_CLOSING)
    expect(section(buildContext(input('review')), '마무리 안내 문구')).toBe(REVIEW_CLOSING)
  })

  it('승인 방식은 설정을 따르고, 지적이 없을 때만 자동 승인한다고 적는다 (D213)', () => {
    const md = buildContext(input('review'))
    expect(section(md, '승인 방식')).toBe(
      '자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다. 리뷰는 지적이 없을 때만 자동 승인한다)',
    )
    const off: AppConfig = {
      ...DEFAULT_CONFIG,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, review: false },
    }
    expect(section(buildContext(input('review', {}, off)), '승인 방식')).toBe(
      '수동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다. 리뷰는 지적이 없을 때만 자동 승인한다)',
    )
    expect(approvalMode(off, {}, 'review')).toBe('manual')
  })

  it('질문 방식은 review 스킬의 설정이다. 기본은 초안 우선이다 (5.1.1)', () => {
    expect(section(buildContext(input('review')), '질문 방식')).toBe('초안 우선 (`draft_first`)')
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      question_mode: { ...DEFAULT_CONFIG.question_mode, review: 'confirm_each' },
    }
    expect(questionMode(config, {}, 'review')).toBe('confirm_each')
    expect(section(buildContext(input('review', {}, config)), '질문 방식')).toBe(
      '결정마다 확인 (`confirm_each`)',
    )
  })

  it('기본 다음 단계는 verify이고, 이전 단계는 그 크기가 고를 수 있는 fix까지의 단계다 (3.2, D149)', () => {
    expect(section(buildContext(input('review')), '선택 가능한 다음 단계')).toBe(
      [
        '- 기본 다음 단계: verify (최종 검증)',
        '- 이전 단계: intake (의도 정리), evidence (재현과 관찰), rca (원인 분석), fix (수정)',
      ].join('\n'),
    )
    expect(
      section(buildContext(input('review', {}, undefined, 'S')), '선택 가능한 다음 단계'),
    ).toBe(
      [
        '- 기본 다음 단계: verify (최종 검증)',
        '- 이전 단계: intake (의도 정리), investigate (재현과 원인 분석), fix (수정)',
      ].join('\n'),
    )
  })
})

describe('context.md: verify', () => {
  const md = buildContext(input('verify'))

  it('기본 다음 단계는 Work 완료이고, [승인]은 Work 완료 화면의 [완료만]이다 (D104)', () => {
    expect(section(md, '선택 가능한 다음 단계')).toBe(
      [
        '- 기본 다음 단계: Work 완료',
        '- 이전 단계: intake (의도 정리), evidence (재현과 관찰), rca (원인 분석), fix (수정), review (리뷰)',
      ].join('\n'),
    )
    expect(section(md, '마무리 안내 문구')).toContain('[완료만]을 누르세요')
  })

  it('필요한 산출물에 리뷰의 review.md 경로가 들어간다 (5.6.8)', () => {
    const T = `${WORK_DIR}\\tasks`
    const previous = previousInputs([
      { taskId: 't-04', node: 'fix', artifacts: [`${T}\\04-fix\\fix.md`] },
      { taskId: 't-05', node: 'review', artifacts: [`${T}\\05-review\\review.md`] },
    ])
    const text = section(buildContext(input('verify', previous)), '필요한 산출물')
    expect(text).toBe(
      [`- t-04 fix: ${T}\\04-fix\\fix.md`, `- t-05 review: ${T}\\05-review\\review.md`].join('\n'),
    )
  })
})

describe('마무리 안내 문구 (D104, D132)', () => {
  it('노드에 따라 고정 문구를 쓴다. 자동 승인을 켤 수 있는 단계는 수동과 자동을 한 문구에 적는다', () => {
    for (const node of ['evidence', 'rca', 'fix'] as const) {
      expect(closingMessage(node)).toBe(
        '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.',
      )
    }
    expect(closingMessage('intake')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [의도 승인]을 누르세요. 고칠 점은 여기에 말해 주세요.',
    )
    expect(closingMessage('verify')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만]을 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.',
    )
  })

  it('verify는 Work 완료 화면에서 누를 수 있는 전달 버튼을 적는다 (D104, D67, D118)', () => {
    expect(closingMessage('verify', ['[완료만]', '[push]', '[PR 생성]'])).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push], [PR 생성] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.',
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
    // [이 단계 끝나면 멈춤]은 task가 도는 중에도 켜고 끌 수 있고, 이전 단계 추천은 에이전트가 마지막에 정한다
    for (const buttons of [[], ['[완료만]', '[push]'], ['[완료만]', '[push]', '[PR 생성]']]) {
      expect(closingMessage('verify', buttons)).toContain(
        '누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은',
      )
    }
    for (const node of ['intake', 'evidence', 'rca', 'fix', 'review'] as const) {
      expect(closingMessage(node)).not.toContain('[승인하고 멈춤]')
    }
    // 의도 승인과 Work 완료는 늘 수동이라 자동 승인을 적지 않는다. 리뷰는 지적이 없을 때를 적는다 (4.2, D213)
    for (const node of ['intake', 'verify'] as const) {
      expect(closingMessage(node)).not.toContain('자동 승인')
    }
    expect(closingMessage('review')).toContain('지적이 없고 자동 승인이 켜져 있으면')
  })

  it('승인 방식 절은 task를 시작할 때의 설정이다. 문구는 설정과 상관없이 같다 (D128, D132)', () => {
    const config = {
      ...DEFAULT_CONFIG,
      auto_approve: {
        investigate: false,
        evidence: false,
        rca: true,
        fix: false,
        review: false,
        respond: false,
      },
    }
    const md = buildContext(input('rca', {}, config))
    expect(section(md, '승인 방식')).toBe(
      '자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)',
    )
    expect(section(md, '마무리 안내 문구')).toBe(closingMessage('rca'))
    expect(section(buildContext(input('rca')), '마무리 안내 문구')).toBe(closingMessage('rca'))
    expect(section(buildContext(input('intake', {}, config)), '승인 방식')).toBe(
      '수동 승인 (의도 승인, Work 완료는 늘 수동)',
    )
  })
})

describe('Work별 덮어쓰기 (D72)', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    auto_approve: {
      investigate: false,
      evidence: true,
      rca: true,
      fix: false,
      review: false,
      respond: false,
    },
    question_mode: { ...DEFAULT_CONFIG.question_mode, 'root-cause': 'confirm_each' },
  }

  it('Work 설정이 있으면 앱 설정보다 우선하고, 없는 키는 앱 설정을 따른다', () => {
    const settings: WorkSettings = {
      auto_approve: { rca: false },
      question_mode: { fix: 'confirm_each' },
    }
    expect(approvalMode(config, settings, 'rca')).toBe('manual')
    expect(approvalMode(config, settings, 'evidence')).toBe('auto')
    expect(questionMode(config, settings, 'rca')).toBe('confirm_each')
    expect(questionMode(config, settings, 'fix')).toBe('confirm_each')
    expect(questionMode(config, settings, 'evidence')).toBe('draft_first')
  })

  it('intake와 verify는 항상 수동이다. 리뷰는 설정을 따른다 (4.2, D213)', () => {
    expect(approvalMode(config, {}, 'intake')).toBe('manual')
    expect(approvalMode(config, {}, 'verify')).toBe('manual')
    expect(approvalMode(config, {}, 'review')).toBe('manual')
    expect(approvalMode(config, { auto_approve: { review: true } }, 'review')).toBe('auto')
  })

  it('context.md의 질문 방식은 Work 설정을 따른다', () => {
    const { work, task } = workAt('rca', {
      settings: { question_mode: { 'root-cause': 'confirm_each' } },
    })
    const md = buildContext({ ...input('rca'), work, task })
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
        node: 'evidence',
        handoff: handoff(
          '  - "캐시 TTL 가설: 캐시를 꺼도 재현됨"\n  - 3\n  - 가설: 따옴표 없으면 객체',
        ),
        artifacts: [`${T}\\02-evidence\\evidence.md`],
      },
      {
        taskId: 't-03',
        node: 'rca',
        handoff: '머리글 없음',
        artifacts: [`${T}\\03-rca\\rca.md`, `${T}\\03-rca\\notes.md`],
      },
    ])
    expect(r.rejected).toEqual([
      { taskId: 't-01', node: 'intake', items: [] },
      { taskId: 't-02', node: 'evidence', items: ['캐시 TTL 가설: 캐시를 꺼도 재현됨'] },
      { taskId: 't-03', node: 'rca', items: [] },
    ])
    expect(r.previousHandoff).toEqual({ taskId: 't-03', node: 'rca', text: '머리글 없음' })
    // 산출물은 경로만. intake의 intent 초안은 확정한 intent가 대신한다
    expect(r.artifacts).toEqual([
      { taskId: 't-02', node: 'evidence', path: `${T}\\02-evidence\\evidence.md` },
      { taskId: 't-03', node: 'rca', path: `${T}\\03-rca\\rca.md` },
      { taskId: 't-03', node: 'rca', path: `${T}\\03-rca\\notes.md` },
    ])
  })

  it('이전 task가 없으면 모두 비어 있다', () => {
    expect(previousInputs([])).toEqual({ rejected: [], previousHandoff: null, artifacts: [] })
  })
})

describe('단계 선택으로 들어온 task (시나리오 2-4, 6.2)', () => {
  const rewind: SelectionInput = {
    reason: 'rewind',
    from: { taskId: 't-05', node: 'verify' },
    instruction: '빈 배열 말고 null도 봐 줘.\n\n```\nnull\n```',
    discarded: [
      {
        taskId: 't-04',
        node: 'fix',
        handoff: true,
        summary: '빈 배열이면 0.\n여러 줄 요약',
        rejected: ['캐시 가설: 없음'],
        recommended: null,
      },
      {
        taskId: 't-05',
        node: 'verify',
        handoff: true,
        summary: null,
        rejected: [],
        recommended: { node: 'fix', reason: '완료조건 2 실패' },
      },
      {
        taskId: 't-06',
        node: 'verify',
        handoff: false,
        summary: null,
        rejected: [],
        recommended: null,
      },
    ],
    dropped: [],
    skipped: [],
    keepCode: false,
    reset: true,
  }

  it('되감기: 사람 추가 지시, 폐기된 시도 요약, 코드를 맨 위에 넣는다', () => {
    const md = buildContext(input('fix', { selection: rewind }))
    expect([...sections(md).keys()][0]).toBe('되감기로 들어옴 (먼저 읽을 것)')
    expect(section(md, '되감기로 들어옴 (먼저 읽을 것)')).toBe(
      [
        '사람이 단계 선택으로 이 단계를 다시 실행한다(t-05 verify (최종 검증)에서 고름). 폐기된 task의 산출물, 결정, 기각 목록은 아래 입력에서 뺐다. 사람 추가 지시를 따르고, 폐기된 시도를 그대로 되풀이하지 않는다.',
        '',
        '### 사람 추가 지시',
        '',
        '````text',
        '빈 배열 말고 null도 봐 줘.',
        '',
        '```',
        'null',
        '```',
        '````',
        '',
        '### 폐기된 시도 요약',
        '',
        '- t-04 fix (수정)',
        '  - 요약: 빈 배열이면 0. 여러 줄 요약',
        '  - 기각: 캐시 가설: 없음',
        '- t-05 verify (최종 검증)',
        '  - 요약: 없음',
        '  - 기각: 없음',
        '  - 이전 단계 추천: fix (수정) — 완료조건 2 실패',
        '- t-06 verify (최종 검증): handoff 없음',
        '',
        '### 코드',
        '',
        '고른 단계를 시작할 때의 커밋으로 되돌렸다. 폐기된 시도의 코드는 입력이 아니다.',
      ].join('\n'),
    )
    // 나머지 절은 처음 실행할 때와 같다
    expect([...sections(md).keys()].slice(1)).toEqual([
      ...sections(buildContext(input('fix'))).keys(),
    ])
  })

  it('[현재 코드 위에서 이어서]와 되돌리지 않은 코드, 없는 추가 지시', () => {
    const keep = buildContext(
      input('fix', { selection: { ...rewind, keepCode: true, reset: false } }),
    )
    expect(section(keep, '되감기로 들어옴 (먼저 읽을 것)')).toContain(
      '### 코드\n\n[현재 코드 위에서 이어서]: 폐기된 시도의 커밋이 남아 있다. 그 위에서 이어서 고친다.',
    )
    const none = buildContext(
      input('fix', { selection: { ...rewind, instruction: null, discarded: [], reset: false } }),
    )
    const body = section(none, '되감기로 들어옴 (먼저 읽을 것)')
    expect(body).toContain('### 사람 추가 지시\n\n없음\n')
    expect(body).toContain('### 폐기된 시도 요약\n\n없음\n')
    expect(body).toContain('### 코드\n\n코드는 되돌리지 않았다.')
  })

  it('건너뛰기: 건너뛴 단계, 폐기한 task, 사람 추가 지시. 폐기된 시도 요약은 없다', () => {
    const skip: SelectionInput = {
      ...rewind,
      reason: 'skip',
      from: { taskId: 't-03', node: 'rca' },
      instruction: '바로 검증해 줘',
      dropped: [{ taskId: 't-03', node: 'rca' }],
      skipped: ['fix'],
    }
    const md = buildContext(input('verify', { selection: skip }))
    expect(section(md, '건너뛰어 들어옴 (먼저 읽을 것)')).toBe(
      [
        '사람이 단계 선택으로 이 단계를 실행한다(t-03 rca (원인 분석)에서 고름). 입력은 지금까지 승인된 것이다. 코드는 되돌리지 않았다.',
        '',
        '- 건너뛴 단계: fix (수정)',
        '- 폐기한 task: t-03 rca (원인 분석)',
        '',
        '### 사람 추가 지시',
        '',
        '```text',
        '바로 검증해 줘',
        '```',
      ].join('\n'),
    )
    expect(md).not.toContain('폐기된 시도 요약')
  })

  it('기본 진행으로 들어왔으면 사람 추가 지시가 있을 때만 넣는다', () => {
    const plain: SelectionInput = { ...rewind, reason: 'default', discarded: [] }
    const md = buildContext(input('rca', { selection: plain }))
    expect([...sections(md).keys()][0]).toBe('사람 추가 지시 (먼저 읽을 것)')
    expect(section(md, '사람 추가 지시 (먼저 읽을 것)')).toMatch(
      /^사람이 단계 선택으로 이 단계를 고르며 남긴 지시다\(t-05 verify \(최종 검증\)에서 고름\)\./,
    )
    const empty = buildContext(input('rca', { selection: { ...plain, instruction: null } }))
    expect(empty).toBe(buildContext(input('rca')))
  })

  it('폐기된 시도 요약은 handoff의 요약, rejected, 이전 단계 추천이다', () => {
    const handoff = [
      '---',
      'status: awaiting_approval',
      'rejected:',
      '  - "캐시 가설: 없음"',
      'recommended_next:',
      '  node: fix',
      '  reason: "완료조건 2 실패"',
      '---',
      '## 요약',
      '검증 실패',
      '',
      '## 다음 task가 알아야 할 것',
      '- x',
      '',
    ].join('\n')
    expect(
      discardedAttempts([
        { taskId: 't-05', node: 'verify', handoff },
        // 기본 다음 단계 추천은 넣지 않는다
        { taskId: 't-03', node: 'rca', handoff },
        { taskId: 't-02', node: 'evidence', handoff: '머리글 없음\n## 요약\n본문만 있음\n' },
        { taskId: 't-06', node: 'verify' },
      ]),
    ).toEqual([
      {
        taskId: 't-05',
        node: 'verify',
        handoff: true,
        summary: '검증 실패',
        rejected: ['캐시 가설: 없음'],
        recommended: { node: 'fix', reason: '완료조건 2 실패' },
      },
      {
        taskId: 't-03',
        node: 'rca',
        handoff: true,
        summary: '검증 실패',
        rejected: ['캐시 가설: 없음'],
        recommended: null,
      },
      {
        taskId: 't-02',
        node: 'evidence',
        handoff: true,
        summary: '본문만 있음',
        rejected: [],
        recommended: null,
      },
      {
        taskId: 't-06',
        node: 'verify',
        handoff: false,
        summary: null,
        rejected: [],
        recommended: null,
      },
    ])
  })
})

describe('context.md: 엔진별 승인 정책', () => {
  it('Codex fix/리뷰/PR 대응은 현재 기본 엔진과 관계없이 수동이며 카운트다운을 약속하지 않는다', () => {
    const config = {
      ...DEFAULT_CONFIG,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, fix: true, respond: true },
    }
    for (const node of ['fix', 'review', 'respond'] as const) {
      const base = input('fix', {}, config)
      const md = buildContext({
        ...base,
        task: { ...base.task, node, engine: 'codex' },
        work: { ...base.work, settings: { auto_approve: { fix: true, respond: true } } },
      })
      expect(section(md, '승인 방식')).toContain('수동 승인 (Codex')
      expect(section(md, '마무리 안내 문구')).not.toContain('카운트다운')
      expect(section(md, '마무리 안내 문구')).toContain('[승인]')
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
