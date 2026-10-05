// 지식 검토 호출 (D300, followup.md 라). verify가 지식을 바꾸고 기계적 확인(D293, D294, D296, D297)을 지나면 앱이 짧은 모델
// 호출을 한 번 해서 뜻을 본다: 같은 대상을 다르게 말하는 항목, 사람의 이번 말과 어긋나는데 고치지 않은 항목, 규칙 절에 적은
// 지금 상태나 정하지 않은 것, "모른다" 메모, 근거 없이 넓힌 규칙. 찾은 것은 형식 되돌림(D21)으로 verify에 돌려보낸다.
// 이 파일은 순수 함수만 둔다(입력 고르기, 프롬프트, 결과 읽기). 호출과 기록은 main/work.ts다.
import type { FormatIssue } from '../shared/work'
import { HANDOFF_FILE } from './validate'
import { identifiersIn, pathsIn, rankEntries, type KnowledgeEntry } from './knowledge'

/** 검토에 함께 넣는 관련 항목 수의 상한. 비용은 이 수에 묶인다 */
export const REVIEW_RELATED_LIMIT = 8

/** 한 verify task에서 부르는 검토의 상한: 처음 한 번과, 되돌린 뒤 고친 것을 한 번 */
export const REVIEW_CALL_LIMIT = 2

/** 검토 호출 하나의 제한 시간. Stop 훅의 제한(STOP_HOOK_TIMEOUT_SEC)보다 넉넉히 짧다 */
export const REVIEW_TIMEOUT_MS = 90_000

/** 검토 호출의 기록 파일 (task 디렉터리). 산출물이 아니다 */
export const REVIEW_FILE = 'knowledge-review.json'

/** RELAY_KNOWLEDGE_REVIEW=off면 검토 호출을 끈다(지식 관리는 켠 채로) */
export function reviewEnabled(env: NodeJS.ProcessEnv): boolean {
  return (env['RELAY_KNOWLEDGE_REVIEW'] ?? '').trim().toLowerCase() !== 'off'
}

export interface ReviewInput {
  /** 이 Work가 더하거나 고친 지식 */
  changed: readonly { path: string; text: string }[]
  /** 이 Work가 지운 지식 경로 */
  removed: readonly string[]
  /** 바꾼 지식과 관련 있어 보이는 다른 항목 (relatedEntries) */
  related: readonly { path: string; text: string }[]
  /** Work 요청 원문 */
  request: string
  /** 승인된 intent. 없으면 null */
  intent: string | null
  /** 이번 Work의 사람 결정 (decisions.md의 by: human) */
  humanDecisions: string
  /** 앞 task들의 지식 후보 */
  candidates: readonly string[]
}

/** 바꾼 지식과 관련 있어 보이는 다른 항목: 바꾼 지식의 글과 요청을 단서로 점수가 있는 것을 높은 차례로 */
export function relatedEntries(
  current: ReadonlyMap<string, string>,
  changed: readonly { path: string; text: string }[],
  request: string,
): { path: string; text: string }[] {
  const mine = new Set(changed.map((c) => c.path))
  const others: KnowledgeEntry[] = [...current]
    .filter(([p]) => !mine.has(p))
    .map(([p, text]) => ({ path: p, text }))
  if (!others.length || !changed.length) return []
  const text = [request, ...changed.map((c) => c.text)].join('\n')
  const ranked = rankEntries(others, {
    text,
    paths: pathsIn(text),
    identifiers: identifiersIn(text),
  })
  return ranked
    .filter((r) => r.score > 0)
    .slice(0, REVIEW_RELATED_LIMIT)
    .map((r) => ({ path: r.entry.path, text: r.entry.text }))
}

const REVIEW_KINDS = [
  'conflict',
  'contradicts_human',
  'state_in_rule',
  'undecided_in_rule',
  'unknown_note',
  'overgeneral',
] as const

const KIND_LABEL: Record<(typeof REVIEW_KINDS)[number], string> = {
  conflict: '다른 항목과 어긋남',
  contradicts_human: '사람의 이번 말과 어긋남',
  state_in_rule: '규칙 절에 지금 상태',
  undecided_in_rule: '규칙 절에 정하지 않은 것',
  unknown_note: '모른다는 메모',
  overgeneral: '근거 없이 넓힌 규칙',
}

export const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          kind: { type: 'string', enum: [...REVIEW_KINDS] },
          quote: { type: 'string' },
          human: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['file', 'kind', 'quote', 'human', 'fix'],
      },
    },
  },
  required: ['issues'],
} as const

export const REVIEW_SYSTEM =
  '너는 소프트웨어 팀의 지식 파일(docs/knowledge/)을 검토한다. 이번 일(Work)에서 바꾼 지식이 다음 사람에게 틀린 규칙을 남기지 않는지만 본다. 확실한 문제만 적고, 문체나 사소한 것은 적지 않는다. 문제가 없으면 빈 배열을 돌려준다.'

const block = (title: string, files: readonly { path: string; text: string }[]) =>
  files.length
    ? [
        `## ${title}`,
        ...files.map((f) => `\n### ${f.path}\n\n\`\`\`\`markdown\n${f.text.trim()}\n\`\`\`\``),
      ]
    : [`## ${title}`, '', '없음']

/** 검토 프롬프트 */
export function reviewPrompt(input: ReviewInput): string {
  return [
    '이번 Work에서 바꾼 지식 파일을 아래 기준으로 검토하라.',
    '',
    '찾을 것 (kind):',
    '- conflict: 바꾼 항목이 관련 항목과 같은 대상(같은 규칙, 같은 값, 같은 코드 이름)을 다른 값이나 다른 규칙으로 말한다. 한쪽이 옛 값이면 그쪽을 file로 적는다',
    '- contradicts_human: 사람의 이번 말(요청, intent, 사람 결정, "(사람)" 후보)과 어긋나는데 고치지 않은 항목. human에 어긋나는 사람의 말을 위 입력에서 그대로 인용한다. 인용할 말이 없으면 이 kind로 적지 않는다',
    '- state_in_rule: `## 규칙`에 이래야 하는 것이 아니라 지금 코드의 상태("~가 남아 있다", "지금은 ~를 쓴다", "~는 이번에 수정하지 않는다" 같은 한 Work의 범위)를 적었다. 그런 것은 `## 아직 규칙을 따르지 않는 곳`에 가야 한다. 사람이 오래 지킬 제약으로 말한 것(예: "이미 저장된 값은 다시 계산하지 않는다", "출력 형식은 바뀌면 안 된다")은 규칙이라 문제가 아니다',
    '- undecided_in_rule: 사람이 정하지 않은 것("따로 정한다", "이번 범위가 아니다")을 `## 규칙`에 정해진 것처럼 적었다. `## 아직 정하지 않은 것`에 가야 한다',
    '- unknown_note: "모른다", "확인하지 못했다"만 담은 항목이나 줄. `## 아직 정하지 않은 것`의 줄 가운데 사람이 미정이라고 한 말이 입력에 없는 것(에이전트가 떠올린 열린 질문)도 여기다',
    '- overgeneral: 이번 일의 근거로는 좁은 사실을 넓은 규칙으로 일반화했다(예: 한 모듈의 사정을 모든 모듈의 규칙으로)',
    '',
    '각 문제: file(바꿀 지식 파일 경로), kind, quote(문제 문장을 짧게 그대로), human(contradicts_human이면 사람의 말 인용, 아니면 빈 문자열), fix(verify가 할 일 한 문장).',
    'fix는 사람이 정하지 않은 것을 정하게 만들면 안 된다. 정하지 않은 사항이 끼면 `## 아직 정하지 않은 것`으로 옮기라고 하고, 어느 값을 규칙으로 쓰라고 하지 않는다.',
    '`## 아직 규칙을 따르지 않는 곳`, `## 바뀐 이력`에 적은 상태와 옛 값, `## 아직 정하지 않은 것`에 사람의 말을 근거로 적은 줄은 문제가 아니다. 관련 항목끼리만의 문제(바꾼 항목이 끼지 않은 것)는 적지 않는다.',
    '',
    '## 이번 Work의 요청',
    '',
    input.request.trim() || '없음',
    '',
    '## 승인된 intent',
    '',
    input.intent?.trim() || '없음',
    '',
    '## 사람 결정',
    '',
    input.humanDecisions.trim() || '없음',
    '',
    '## 앞 단계의 지식 후보',
    '',
    input.candidates.length ? input.candidates.map((c) => `- ${c}`).join('\n') : '없음',
    '',
    ...block('이번 Work가 더하거나 고친 지식', input.changed),
    '',
    `## 이번 Work가 지운 지식`,
    '',
    input.removed.length ? input.removed.map((p) => `- ${p}`).join('\n') : '없음',
    '',
    ...block('관련 있어 보이는 다른 지식 (바꾸지 않음)', input.related),
  ].join('\n')
}

/** 검토 결과를 형식 오류로 바꾼다. 읽지 못하면 빈 목록. 없는 파일을 가리키면 handoff로 돌린다 */
export function reviewIssues(output: unknown, known: ReadonlySet<string>): FormatIssue[] {
  const issues = (output as { issues?: unknown } | null)?.issues
  if (!Array.isArray(issues)) return []
  const out: FormatIssue[] = []
  for (const raw of issues) {
    const i = raw as {
      file?: unknown
      kind?: unknown
      quote?: unknown
      human?: unknown
      fix?: unknown
    }
    const kind = REVIEW_KINDS.find((k) => k === i.kind)
    const fix = typeof i.fix === 'string' ? i.fix.trim() : ''
    const human = typeof i.human === 'string' ? i.human.trim() : ''
    if (!kind || !fix) continue
    // 사람 말과 어긋난다는 지적은 그 말을 인용해야 한다 (E12: 근거 없이 맞는 규칙을 틀렸다고 함)
    if (kind === 'contradicts_human' && !human) continue
    const file =
      typeof i.file === 'string' && known.has(i.file.trim()) ? i.file.trim() : HANDOFF_FILE
    const quote = typeof i.quote === 'string' && i.quote.trim() ? ` "${i.quote.trim()}"` : ''
    out.push({
      file,
      part: 'body',
      message: `[지식 검토: ${KIND_LABEL[kind]}]${quote}${kind === 'contradicts_human' ? ` (사람: "${human}")` : ''} → ${fix}`,
    })
  }
  return out
}

/** 검토 호출 한 번의 기록 */
export interface ReviewCall {
  at: string
  /** 입력의 해시. 같은 입력이면 다시 부르지 않는다 */
  hash: string
  model: string
  /** 걸린 시간(ms, 앱이 잰 벽시계) */
  ms: number
  /** claude가 알린 비용(USD). 모르면 null */
  costUsd: number | null
  /** claude가 알린 토큰 */
  usage: {
    input: number
    output: number
    cacheRead: number
    cacheCreation: number
  } | null
  /** 넣은 관련 항목 수와 프롬프트 글자 수 */
  related: number
  promptChars: number
  /** 찾은 문제 (형식 오류 모양) */
  issues: FormatIssue[]
  /** 이 결과로 verify를 되돌렸나 */
  bounced: boolean
  /** 부르지 못했거나 결과를 읽지 못했으면 그 까닭 */
  error: string | null
}

export interface ReviewRecord {
  calls: ReviewCall[]
}

/** decisions.md에서 사람 결정 줄만 (`- [사람] ...`) */
export function humanDecisionLines(decisions: string): string {
  return decisions
    .split('\n')
    .filter((l) => /^\s*-\s*\[사람\]/.test(l))
    .join('\n')
}
