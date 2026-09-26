import { describe, expect, it } from 'vitest'
import {
  approvalMode,
  buildContext,
  closingMessage,
  previousInputs,
  questionMode,
  type ContextInput,
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
  'size: M',
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
  const size = opts.size ?? 'M'
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

function input(node: NodeName, overrides: Partial<ContextInput> = {}, config?: AppConfig) {
  const { work, task } = workAt(node)
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

  it('승인 방식과 마무리 안내 문구 (D104)', () => {
    expect(section(md, '승인 방식')).toBe('수동 승인')
    expect(section(md, '마무리 안내 문구')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 고칠 점은 여기에 말해 주세요.',
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
        '- 기본 다음 단계: 의도 승인 뒤 size에 따라 evidence (재현과 관찰), size가 S이면 fix (수정)',
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

describe('context.md: verify', () => {
  const md = buildContext(input('verify'))

  it('기본 다음 단계는 Work 완료이고, [승인]은 Work 완료 화면의 [완료만]이다 (D104)', () => {
    expect(section(md, '선택 가능한 다음 단계')).toBe(
      [
        '- 기본 다음 단계: Work 완료',
        '- 이전 단계: intake (의도 정리), evidence (재현과 관찰), rca (원인 분석), fix (수정)',
      ].join('\n'),
    )
    expect(section(md, '마무리 안내 문구')).toContain('[완료만]을 누르세요')
  })
})

describe('마무리 안내 문구 (D104)', () => {
  it('승인 방식과 노드에 따라 고정 문구를 쓴다', () => {
    expect(closingMessage('fix', 'manual')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 고칠 점은 여기에 말해 주세요.',
    )
    expect(closingMessage('fix', 'auto')).toBe(
      '산출물과 handoff를 썼습니다. 자동 승인이 켜진 단계라 조건을 만족하면 카운트다운 뒤 승인됩니다. 멈추려면 [취소]를 누르거나 여기에 말해 주세요.',
    )
    expect(closingMessage('intake', 'manual')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [의도 승인]을 누르세요. 고칠 점은 여기에 말해 주세요.',
    )
    expect(closingMessage('verify', 'manual')).toBe(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만]을 누르세요. 고칠 점은 여기에 말해 주세요.',
    )
  })

  it('자동 승인이 켜진 단계는 자동 문구를 넣는다', () => {
    const config = { ...DEFAULT_CONFIG, auto_approve: { evidence: false, rca: true, fix: false } }
    const md = buildContext(input('rca', {}, config))
    expect(section(md, '승인 방식')).toBe('자동 승인')
    expect(section(md, '마무리 안내 문구')).toBe(closingMessage('rca', 'auto'))
  })
})

describe('Work별 덮어쓰기 (D72)', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    auto_approve: { evidence: true, rca: true, fix: false },
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

  it('intake와 verify는 항상 수동이다 (4.2)', () => {
    expect(approvalMode(config, {}, 'intake')).toBe('manual')
    expect(approvalMode(config, {}, 'verify')).toBe('manual')
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
