import { describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import {
  bounceMessage,
  checkHandoff,
  checkIntentDraft,
  checkPr,
  checkTask,
  isValid,
  parseFrontMatter,
  sectionNames,
} from '../../src/core/validate'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { NodeName, Size } from '../../src/shared/contracts'

// ---------- 예시 ----------

const HANDOFF_FIELDS = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [
    {
      what: '원인은 토큰 만료 시각 비교의 타임존 불일치',
      why: 'UTC/KST 9시간 차이와 일치',
      by: 'ai',
    },
  ],
  assumptions: ['운영 서버 TZ도 Asia/Seoul이다 (확인 안 됨)'],
  rejected: ['캐시 TTL 가설: 캐시를 끄고도 재현됨'],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
  knowledge_candidates: [],
}

const HANDOFF_BODY = [
  '## 요약',
  '만료 판정이 로컬 시각 문자열 비교라 KST에서 9시간 일찍 만료된다.',
  '',
  '## 다음 task가 알아야 할 것',
  '- 수정 지점: `src/auth/token.ts` `isExpired()`',
  '',
].join('\n')

/** 필드를 바꾼 handoff. 값이 undefined인 필드는 뺀다 */
function handoff(fields: Record<string, unknown> = {}, body = HANDOFF_BODY): string {
  const data = Object.fromEntries(
    Object.entries({ ...HANDOFF_FIELDS, ...fields }).filter(([, v]) => v !== undefined),
  )
  return `---\n${stringify(data)}---\n${body}`
}

const DRAFT_BODY = [
  '## 목표',
  'KST 서버에서 액세스 토큰이 발급 직후 만료로 판정되는 문제를 고친다.',
  '',
  '## 비목표',
  '- 토큰 수명 정책 변경',
  '',
  '## 원하는 결과',
  '서버 타임존과 관계없이 만료 판정이 수명과 일치한다.',
  '',
  '## 완료조건',
  '- [ ] 재현 절차가 더 이상 실패하지 않는다',
  '- [ ] `npm test`가 통과한다',
  '',
  '- [ ] 기존 테스트를 약화하거나 삭제하지 않는다',
  '',
  '## 추가 의견',
  '- (사람 추정, 확인 안 됨) `Date` 문자열 비교 부분이 의심된다',
  '',
].join('\n')

function draft(header = 'type: bugfix\nsize: M', body = DRAFT_BODY): string {
  return `---\n${header}\n---\n${body}`
}

const WARN = { warnChars: 1500 }
const errorsOf = (r: { errors: { message: string }[] }) => r.errors.map((e) => e.message)

function check(
  node: NodeName,
  files: Record<string, string>,
  size: Size | undefined = 'M',
): ReturnType<typeof checkTask> {
  return checkTask({ node, size, files, config: DEFAULT_CONFIG })
}

// ---------- 머리글 ----------

describe('머리글 읽기', () => {
  it('통과: 첫 줄 ---부터 다음 --- 줄까지를 YAML로 읽는다', () => {
    const fm = parseFrontMatter(handoff())
    expect(fm.ok).toBe(true)
    expect(fm.ok && fm.data['status']).toBe('awaiting_approval')
    expect(fm.body.startsWith('## 요약')).toBe(true)
  })

  it('통과: CRLF 줄 끝과 BOM도 읽는다', () => {
    const text = `\uFEFF${handoff().replace(/\n/g, '\r\n')}`
    expect(errorsOf(checkHandoff(text, { node: 'rca', size: 'M', ...WARN }))).toEqual([])
  })

  it('실패: 머리글이 없다', () => {
    expect(errorsOf(checkHandoff(HANDOFF_BODY, { node: 'rca', size: 'M', ...WARN }))).toEqual([
      '머리글 없음: 첫 줄이 `---`인 YAML 머리글이 필요함',
    ])
  })

  it('실패: 머리글이 닫히지 않았다', () => {
    expect(errorsOf(checkHandoff('---\nstatus: blocked\n', { node: 'rca', ...WARN }))).toEqual([
      '머리글이 닫히지 않음: 머리글 끝에 `---` 줄이 필요함',
    ])
  })

  it('실패: YAML 문법 오류', () => {
    const [e] = errorsOf(checkHandoff('---\nstatus: a: b\n---\n', { node: 'rca', ...WARN }))
    expect(e).toMatch(/^머리글 YAML을 읽을 수 없음: .+/)
  })

  it('실패: 같은 필드가 두 번 있다', () => {
    const text = handoff().replace('status: awaiting_approval', 'status: blocked\nstatus: blocked')
    const [e] = errorsOf(checkHandoff(text, { node: 'rca', ...WARN }))
    expect(e).toMatch(/^머리글 YAML을 읽을 수 없음: /)
  })

  it('실패: 머리글이 필드 목록이 아니다', () => {
    expect(errorsOf(checkHandoff('---\n- a\n- b\n---\n', { node: 'rca', ...WARN }))).toEqual([
      '머리글이 `필드: 값` 목록이 아님',
    ])
  })
})

// ---------- 스키마 검사 ----------

describe('스키마 검사: handoff (5.2.1)', () => {
  const run = (fields: Record<string, unknown>) =>
    errorsOf(checkHandoff(handoff(fields), { node: 'rca', size: 'M', ...WARN }))

  it('통과: 필수 필드를 모두 채웠다 (knowledge_candidates는 선택)', () => {
    expect(run({})).toEqual([])
    expect(run({ knowledge_candidates: undefined })).toEqual([])
  })

  it('실패: 필수 필드가 없다', () => {
    expect(run({ decisions: undefined, risks: undefined })).toEqual([
      '`decisions` 없음: 필수 필드',
      '`risks` 없음: 필수 필드',
    ])
  })

  it('실패: status가 허용값이 아니거나 비어 있다', () => {
    expect(run({ status: 'done' })).toEqual([
      '`status` 값이 허용값이 아님 (허용값: awaiting_approval | blocked, 지금: done)',
    ])
    expect(run({ status: null })).toEqual([
      '`status` 값이 허용값이 아님 (허용값: awaiting_approval | blocked, 지금: 비어 있음)',
    ])
  })

  it('실패: 목록 필드의 형식이 틀렸다', () => {
    expect(run({ assumptions: '가정 하나' })).toEqual([
      '`assumptions` 형식이 틀림 (기대: 목록, 지금: 문자열)',
    ])
    expect(run({ decisions: null })).toEqual([
      '`decisions` 형식이 틀림 (기대: 목록, 지금: 비어 있음)',
    ])
  })

  it('실패: decisions 항목의 필드가 없거나 by가 허용값이 아니다', () => {
    expect(run({ decisions: [{ what: '크기는 M', by: 'robot' }] })).toEqual([
      '`decisions[0].why` 없음: 필수 필드',
      '`decisions[0].by` 값이 허용값이 아님 (허용값: human | ai, 지금: robot)',
    ])
    expect(run({ decisions: [{ what: '', why: '이유', by: 'human' }] })).toEqual([
      '`decisions[0].what` 값이 비어 있음: 빈 문자열은 안 됨',
    ])
  })

  it('통과: blocked이고 blocked_reason이 있다. awaiting_approval이면 blocked_reason이 비어도 된다 (D96)', () => {
    expect(run({ status: 'blocked', blocked_reason: '운영 로그가 없음' })).toEqual([])
    expect(run({ status: 'awaiting_approval', blocked_reason: null })).toEqual([])
    expect(run({ status: 'awaiting_approval', blocked_reason: undefined })).toEqual([])
  })

  it('실패: blocked인데 blocked_reason이 비었거나 없다', () => {
    expect(run({ status: 'blocked', blocked_reason: null })).toEqual([
      '`blocked_reason` 없음: `status: blocked`일 때 필수',
    ])
    expect(run({ status: 'blocked', blocked_reason: undefined })).toEqual([
      '`blocked_reason` 없음: `status: blocked`일 때 필수',
    ])
    expect(run({ status: 'blocked', blocked_reason: '' })).toEqual([
      '`blocked_reason` 값이 비어 있음: `status: blocked`일 때 필수',
    ])
  })

  it('통과: intent_deviation은 null이거나 {summary, evidence}다', () => {
    expect(run({ intent_deviation: { summary: '요약', evidence: '근거' } })).toEqual([])
  })

  it('실패: intent_deviation의 형식이 틀렸다', () => {
    expect(run({ intent_deviation: '어긋남' })).toEqual([
      '`intent_deviation` 형식이 틀림 (기대: null 또는 {summary, evidence}, 지금: 문자열)',
    ])
    expect(run({ intent_deviation: { summary: '요약' } })).toEqual([
      '`intent_deviation.evidence` 없음: 필수 필드',
    ])
  })

  it('통과: recommended_next는 null이거나 {node, reason}이다', () => {
    expect(run({ recommended_next: { node: 'evidence', reason: '재현이 틀림' } })).toEqual([])
  })

  it('실패: recommended_next의 형식이나 node가 틀렸다', () => {
    expect(run({ recommended_next: 'fix' })).toEqual([
      '`recommended_next` 형식이 틀림 (기대: null 또는 {node, reason}, 지금: 문자열)',
    ])
    expect(run({ recommended_next: { node: 'deploy', reason: '배포' } })).toEqual([
      '`recommended_next.node` 값이 허용값이 아님 (허용값: intake | evidence | rca | fix | verify, 지금: deploy)',
    ])
    expect(run({ recommended_next: { node: 'fix' } })).toEqual([
      '`recommended_next.reason` 없음: 필수 필드',
    ])
  })

  it('읽을 수 있으면 오류가 있어도 status를 돌려준다', () => {
    const r = checkHandoff(handoff({ risks: 3 }), { node: 'rca', size: 'M', ...WARN })
    expect(r.status).toBe('awaiting_approval')
    expect(r.value).toBeNull()
  })
})

describe('스키마 검사: intent 초안 (5.3, D38)', () => {
  it('통과: type과 size가 허용값이다', () => {
    for (const size of ['S', 'M', 'L']) {
      const r = checkIntentDraft(draft(`type: bugfix\nsize: ${size}`), WARN)
      expect(errorsOf(r)).toEqual([])
      expect(r.value).toEqual({ type: 'bugfix', size })
    }
  })

  it('실패: size가 비었거나 type이 허용값이 아니다', () => {
    expect(errorsOf(checkIntentDraft(draft('type: feature\nsize:'), WARN))).toEqual([
      '`type` 값이 허용값이 아님 (허용값: bugfix, 지금: feature)',
      '`size` 값이 허용값이 아님 (허용값: S | M | L, 지금: 비어 있음)',
    ])
    expect(errorsOf(checkIntentDraft(draft('type: bugfix'), WARN))).toEqual([
      '`size` 없음: 필수 필드',
    ])
  })

  it('머리글 오류는 header, 본문 오류는 body로 나눈다 (D90)', () => {
    const r = checkIntentDraft(draft('type: bugfix\nsize: XL', '## 목표\n'), WARN)
    expect(r.errors.map((e) => [e.part, e.field])).toEqual([
      ['header', 'size'],
      ['body', '비목표'],
      ['body', '원하는 결과'],
      ['body', '완료조건'],
    ])
  })
})

// ---------- 추가 검사 ----------

describe('추가 검사: recommended_next.node가 선택 가능한 다음 단계 안에 있다 (3.2)', () => {
  const rec = (node: string) => handoff({ recommended_next: { node, reason: '이유' } })
  const run = (text: string, node: NodeName, size?: Size) =>
    errorsOf(checkHandoff(text, { node, size, ...WARN }))

  it('통과: 이전 단계나 기본 다음 단계', () => {
    expect(run(rec('evidence'), 'rca', 'M')).toEqual([])
    expect(run(rec('fix'), 'rca', 'M')).toEqual([])
    expect(run(rec('fix'), 'verify', 'M')).toEqual([])
    // S 경로의 fix는 건너뛴 evidence나 rca를 추천할 수 있다 (D66)
    expect(run(rec('rca'), 'fix', 'S')).toEqual([])
  })

  it('실패: 뒤 단계를 건너뛰거나 지금 단계를 추천했다', () => {
    expect(run(rec('verify'), 'rca', 'M')).toEqual([
      '`recommended_next.node` 값이 선택 가능한 다음 단계가 아님 (허용값: intake | evidence | fix, 지금: verify)',
    ])
    expect(run(rec('verify'), 'verify', 'M')).toEqual([
      '`recommended_next.node` 값이 선택 가능한 다음 단계가 아님 (허용값: intake | evidence | rca | fix, 지금: verify)',
    ])
  })

  it('intake는 intent 초안의 size로 기본 다음 단계를 정한다', () => {
    const files = (size: string, node: string) => ({
      'handoff.md': rec(node),
      'intent.draft.md': draft(`type: bugfix\nsize: ${size}`),
    })
    expect(errorsOf(check('intake', files('S', 'fix'), undefined))).toEqual([])
    expect(errorsOf(check('intake', files('M', 'evidence'), undefined))).toEqual([])
    expect(errorsOf(check('intake', files('M', 'fix'), undefined))).toEqual([
      '`recommended_next.node` 값이 선택 가능한 다음 단계가 아님 (허용값: evidence, 지금: fix)',
    ])
  })
})

describe('추가 검사: 필수 산출물 (3.1, D30)', () => {
  it('통과: awaiting_approval이고 산출물이 있다', () => {
    expect(errorsOf(check('evidence', { 'handoff.md': handoff(), 'evidence.md': '' }))).toEqual([])
    const verify = { 'handoff.md': handoff(), 'verification.md': '', 'pr.md': '# 제목\n' }
    expect(errorsOf(check('verify', verify))).toEqual([])
  })

  it('실패: awaiting_approval인데 산출물이 없다', () => {
    expect(errorsOf(check('verify', { 'handoff.md': handoff(), 'pr.md': '# 제목\n' }))).toEqual([
      '`verification.md` 없음: `status: awaiting_approval`일 때 필수 산출물',
    ])
    expect(check('rca', { 'handoff.md': handoff() }).errors).toEqual([
      {
        file: 'rca.md',
        part: 'file',
        message: '`rca.md` 없음: `status: awaiting_approval`일 때 필수 산출물',
      },
    ])
  })

  it('통과: blocked이면 산출물을 확인하지 않는다', () => {
    const blocked = handoff({ status: 'blocked', blocked_reason: '운영 로그가 없음' })
    expect(errorsOf(check('rca', { 'handoff.md': blocked }))).toEqual([])
  })
})

describe('추가 검사: 본문 필수 절 (5.2.1)', () => {
  it('통과: handoff 본문에 두 절이 있다', () => {
    expect(sectionNames(HANDOFF_BODY)).toEqual(['요약', '다음 task가 알아야 할 것'])
  })

  it('실패: handoff 본문에 절이 없다', () => {
    const text = handoff({}, '## 요약\n내용\n')
    expect(errorsOf(checkHandoff(text, { node: 'rca', size: 'M', ...WARN }))).toEqual([
      '`## 다음 task가 알아야 할 것` 절 없음: handoff 본문의 필수 절',
    ])
  })

  it('실패: 코드 펜스 안의 제목이나 다른 수준의 제목은 절로 치지 않는다', () => {
    const body = '```markdown\n## 요약\n```\n### 다음 task가 알아야 할 것\n'
    expect(errorsOf(checkHandoff(handoff({}, body), { node: 'rca', size: 'M', ...WARN }))).toEqual([
      '`## 요약` 절 없음: handoff 본문의 필수 절',
      '`## 다음 task가 알아야 할 것` 절 없음: handoff 본문의 필수 절',
    ])
  })

  it('통과: intent 초안 본문에 네 절이 있다 (제약과 추가 의견은 선택)', () => {
    expect(errorsOf(checkIntentDraft(draft(), WARN))).toEqual([])
  })

  it('실패: intent 초안 본문에 절이 없다', () => {
    const body = DRAFT_BODY.replace('## 원하는 결과', '## 결과')
    expect(errorsOf(checkIntentDraft(draft(undefined, body), WARN))).toEqual([
      '`## 원하는 결과` 절 없음: intent 초안 본문의 필수 절',
    ])
  })
})

describe('추가 검사: intent 초안의 완료조건 줄 (5.2.1)', () => {
  it('통과: 빈 줄을 뺀 모든 줄이 "- [ ] "로 시작한다', () => {
    expect(errorsOf(checkIntentDraft(draft(), WARN))).toEqual([])
  })

  it('실패: "- [ ] "로 시작하지 않는 줄이 있다', () => {
    const body = DRAFT_BODY.replace(
      '- [ ] `npm test`가 통과한다',
      '* [ ] `npm test`가 통과한다\n- [x] 끝남\n  (설명)',
    )
    expect(errorsOf(checkIntentDraft(draft(undefined, body), WARN))).toEqual([
      '`## 완료조건`의 줄이 `- [ ] `로 시작하지 않음 (지금: * [ ] `npm test`가 통과한다)',
      '`## 완료조건`의 줄이 `- [ ] `로 시작하지 않음 (지금: - [x] 끝남)',
      '`## 완료조건`의 줄이 `- [ ] `로 시작하지 않음 (지금: (설명))',
    ])
  })
})

describe('추가 검사: verify의 pr.md 첫 줄 (D62)', () => {
  it('통과: 첫 줄이 "# 제목"이다', () => {
    expect(checkPr('# 토큰 만료 판정의 타임존 오류 수정\n\n## 요약\n')).toEqual([])
  })

  it('실패: 첫 줄이 "# "로 시작하지 않거나 제목이 없다', () => {
    expect(checkPr('토큰 만료 수정\n').map((e) => e.message)).toEqual([
      '`pr.md` 첫 줄이 `# <PR 제목>`이 아님 (지금: 토큰 만료 수정)',
    ])
    expect(checkPr('\n# 제목\n').map((e) => e.message)).toEqual([
      '`pr.md` 첫 줄이 `# <PR 제목>`이 아님 (지금: 빈 줄)',
    ])
    expect(checkPr('## 제목\n')).toHaveLength(1)
    expect(checkPr('# \n')).toHaveLength(1)
  })

  it('verify에서만 검사한다', () => {
    const files = { 'handoff.md': handoff(), 'verification.md': '', 'pr.md': '제목\n' }
    expect(errorsOf(check('verify', files))).toHaveLength(1)
    expect(errorsOf(check('fix', { ...files, 'fix.md': '' }))).toEqual([])
  })
})

// ---------- 경고 ----------

describe('경고는 오류로 치지 않는다 (D85, D86, 분량 기준)', () => {
  it('정의되지 않은 필드는 경고만 한다 (중첩된 필드도)', () => {
    const text = handoff({
      priority: 'high',
      decisions: [{ what: '크기는 M', why: '이유', by: 'ai', confidence: 0.9 }],
      recommended_next: { node: 'evidence', reason: '이유', urgent: true },
    })
    const r = checkHandoff(text, { node: 'rca', size: 'M', ...WARN })
    expect(r.errors).toEqual([])
    expect(r.warnings.map((w) => w.message)).toEqual([
      '정의되지 않은 필드 `decisions[0].confidence`: 앱은 무시함',
      '정의되지 않은 필드 `recommended_next.urgent`: 앱은 무시함',
      '정의되지 않은 필드 `priority`: 앱은 무시함',
    ])
    expect(r.value).not.toBeNull()
  })

  it('handoff 본문이 분량 기준을 넘으면 경고만 한다', () => {
    const body = `${HANDOFF_BODY}${'가'.repeat(1500)}\n`
    const files = { 'handoff.md': handoff({}, body), 'rca.md': '' }
    const r = check('rca', files)
    expect(isValid(r)).toBe(true)
    expect(r.warnings.map((w) => w.message)).toEqual([
      `handoff 본문이 분량 기준을 넘음 (기준: 1500자, 지금: ${[...body.trim()].length}자)`,
    ])
  })

  it('intent 초안 본문이 분량 기준을 넘으면 경고만 한다', () => {
    const r = checkIntentDraft(draft(undefined, `${DRAFT_BODY}${'나'.repeat(1500)}`), WARN)
    expect(r.errors).toEqual([])
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]?.message).toMatch(/^intent 초안 본문이 분량 기준을 넘음 \(기준: 1500자/)
  })

  it('문자열과 목록의 길이에는 상한이 없다 (D86)', () => {
    const long = () => ({ what: '가'.repeat(5000), why: '나'.repeat(5000), by: 'ai' })
    const text = handoff({ decisions: Array.from({ length: 200 }, long) })
    expect(errorsOf(checkHandoff(text, { node: 'rca', size: 'M', warnChars: 1e9 }))).toEqual([])
  })
})

// ---------- task 검사와 되돌림 메시지 ----------

describe('task 검사 (5.2.1)', () => {
  it('handoff가 없으면 유효한 handoff가 아니다. 오류는 없다', () => {
    const r = check('rca', { 'rca.md': '' })
    expect(r.handoff_present).toBe(false)
    expect(r.errors).toEqual([])
    expect(isValid(r)).toBe(false)
  })

  it('intake는 handoff 없이도 intent 초안을 검사한다 (D38)', () => {
    const r = check('intake', { 'intent.draft.md': draft('type: bugfix\nsize:') }, undefined)
    expect(r.handoff_present).toBe(false)
    expect(errorsOf(r)).toEqual(['`size` 값이 허용값이 아님 (허용값: S | M | L, 지금: 비어 있음)'])
  })

  it('유효한 handoff면 머리글 값을 돌려준다', () => {
    const r = check('intake', { 'handoff.md': handoff(), 'intent.draft.md': draft() }, undefined)
    expect(isValid(r)).toBe(true)
    expect(r.status).toBe('awaiting_approval')
    expect(r.handoff?.decisions).toEqual(HANDOFF_FIELDS.decisions)
    expect(r.intentDraft).toEqual({ type: 'bugfix', size: 'M' })
  })

  it('산출물 쪽 오류만 있으면 handoff 머리글 값은 남긴다', () => {
    const r = check('fix', { 'handoff.md': handoff() })
    expect(isValid(r)).toBe(false)
    expect(r.handoff?.status).toBe('awaiting_approval')
  })
})

describe('되돌림 메시지 (D21, D87)', () => {
  it('파일, 필드, 어긴 규칙을 적고 경고는 넣지 않는다', () => {
    const r = check('intake', {
      'handoff.md': handoff({ status: 'blocked', blocked_reason: null, extra_field: 1 }),
      'intent.draft.md': draft('type: bugfix\nsize: XL'),
    })
    const msg = bounceMessage(r)
    expect(msg.split('\n').slice(1)).toEqual([
      '- handoff.md: `blocked_reason` 없음: `status: blocked`일 때 필수',
      '- intent.draft.md: `size` 값이 허용값이 아님 (허용값: S | M | L, 지금: XL)',
    ])
    expect(msg).not.toContain('extra_field')
    expect(msg.split('\n')[0]).toContain('오류가 가리키는 파일을 고치고')
  })
})
