// 마무리 단계의 독립 리뷰 (5.6.14, D494~D497). 마무리 단계가 판정표를 쓰고 리뷰를 요청하면 앱이 비대화형 호출 둘을 차례로
// 부른다: 찾기(코드 리뷰, code_review가 켜졌을 때)와 확인(후보 확인과 판정표 확인, 늘). 지침의 원본은 skills/_review.md이고
// (`# Finder`, `# Checker`, 유형 구간), 앱이 Work 유형의 구간만 남겨 브리프에 넣는다. 마무리 세션은 브리프를 쓰지 않는다.
// 이 파일은 순수 함수만 둔다(브리프, 스키마, 결과 읽기, 결과 글). 호출과 파일 쓰기는 main/work.ts다.
import type { WorkType } from '../shared/work'
import { fence } from './knowledge'
import { toolLabel } from './review'

/** 결과 글 (task 디렉터리). 다시 연 마무리 세션이 읽는다 (D496) */
export const REVIEW_RESULT_FILE = 'independent-review.md'

/** 호출마다의 기록 (task 디렉터리): 걸린 시간, 비용, 토큰, 후보 수, 오류 */
export const REVIEW_RECORD_FILE = 'independent-review.json'

/** 앱이 리뷰에 넘기는 변경 파일의 폴더 (task 디렉터리 안) */
export const REVIEW_INPUT_DIR = 'independent-review'

/** 호출 하나의 제한 시간 **(기본값)**: 큰 변경을 도구로 읽어 가며 보는 데 넉넉히 */
export const REVIEW_CALL_TIMEOUT_MS = 30 * 60_000

/** 리뷰가 읽기만 하게 주는 도구 (Claude). Bash를 주지 않아 파일을 바꿀 수 없다: git이 필요한 변경은 앱이 미리 만든다 */
export const REVIEW_TOOLS: readonly string[] = ['Read', 'Grep', 'Glob']

/** 호출 종류: 찾기(코드 리뷰)와 확인 */
export type ReviewCall = 'find' | 'check'

/** 진행 표시와 기록의 호출 이름 (D502) */
export const REVIEW_PHASE: Readonly<Record<ReviewCall, string>> = { find: '찾기', check: '확인' }

/** 호출마다의 진행 기록 파일 (independent-review/ 안, D502). 끝난 뒤에도 남아 Work 완료 화면에서 읽는다 */
export const reviewLogFile = (call: ReviewCall): string => `${call}.log`

/** 진행 표시에 남길 최근 도구 수 (D502) */
export const REVIEW_RECENT = 5

/**
 * 구조화된 출력을 내는 도구. Claude Code가 --json-schema의 답을 이 도구로 낸다(2.1.310에서 봄). 리뷰가 한 일이 아니라
 * 진행에서 뺀다
 */
const STRUCTURED_TOOL = 'StructuredOutput'

/** 진행의 한 걸음 (D502): 도구를 부름, 도구가 끝남, 모델의 글 */
export type ReviewStep =
  | { kind: 'tool'; id: string; label: string }
  | { kind: 'done'; id: string }
  | { kind: 'text'; text: string }

/**
 * 출력 이벤트(`--output-format stream-json`) 하나에서 진행의 걸음 (D502). assistant의 tool_use와 text, user의
 * tool_result만 읽는다(계약: test/contract/claude.ts의 STREAM_CONTRACT). 경로는 root(worktree) 안이면 상대 경로로 보인다
 */
export function reviewSteps(event: Record<string, unknown>, root?: string): ReviewStep[] {
  const type = event['type']
  if (type !== 'assistant' && type !== 'user') return []
  const message = event['message']
  const content = isRecord(message) ? message['content'] : undefined
  if (!Array.isArray(content)) return []
  const out: ReviewStep[] = []
  for (const item of content as unknown[]) {
    if (!isRecord(item)) continue
    const c = item
    const id = typeof c['id'] === 'string' ? c['id'] : ''
    if (type === 'assistant' && c['type'] === 'tool_use' && typeof c['name'] === 'string') {
      if (c['name'] !== STRUCTURED_TOOL)
        out.push({ kind: 'tool', id, label: toolLabel(c['name'], c['input'], root) })
    } else if (type === 'assistant' && c['type'] === 'text' && typeof c['text'] === 'string') {
      const text = c['text'].trim()
      if (text) out.push({ kind: 'text', text })
    } else if (
      type === 'user' &&
      c['type'] === 'tool_result' &&
      typeof c['tool_use_id'] === 'string'
    ) {
      out.push({ kind: 'done', id: c['tool_use_id'] })
    }
  }
  return out
}

/** 진행 기록의 글 길이. 넘으면 줄인다 */
const LOG_TEXT_MAX = 400

/**
 * 진행 기록(find.log, check.log)의 한 줄 (D502): "12:03:04 Read(src/avg.js)", 모델의 글은 들여 써서 한 줄로 줄인다.
 * 도구가 끝난 것은 적지 않는다. time은 시:분:초다
 */
export function reviewLogLine(step: ReviewStep, time: string): string | null {
  if (step.kind === 'done') return null
  if (step.kind === 'tool') return `${time} ${step.label}`
  const one = step.text.replace(/\s+/g, ' ')
  return `${time}   ${one.length > LOG_TEXT_MAX ? `${one.slice(0, LOG_TEXT_MAX - 1)}…` : one}`
}

const SEVERITIES = ['차단', '권장', '사소'] as const
const KINDS = ['정확성', '정리'] as const
const VERDICTS = ['confirmed', 'plausible', 'refuted'] as const

export type Severity = (typeof SEVERITIES)[number]

/** 확인 결과의 화면 이름 (D486) */
const VERDICT_LABEL: Record<'confirmed' | 'plausible', string> = {
  confirmed: '확인됨',
  plausible: '가능성',
}

// codex exec의 구조화된 출력은 정의하지 않은 필드를 막고 모든 필드를 필수로 둔 스키마만 받는다 (D334)
const strict = <T extends Record<string, object>>(properties: T) =>
  ({
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }) as const

export const FIND_SCHEMA = strict({
  candidates: {
    type: 'array',
    items: strict({
      file: { type: 'string' },
      line: { type: 'integer' },
      severity: { type: 'string', enum: [...SEVERITIES] },
      kind: { type: 'string', enum: [...KINDS] },
      summary: { type: 'string' },
      scenario: { type: 'string' },
    }),
  },
  later: {
    type: 'array',
    items: strict({ place: { type: 'string' }, problem: { type: 'string' } }),
  },
})

export const CHECK_SCHEMA = strict({
  candidates: {
    type: 'array',
    items: strict({
      number: { type: 'integer' },
      verdict: { type: 'string', enum: [...VERDICTS] },
      severity: { type: 'string', enum: [...SEVERITIES] },
      evidence: { type: 'string' },
    }),
  },
  objections: {
    type: 'array',
    items: strict({
      criterion: { type: 'string' },
      problem: { type: 'string' },
      evidence: { type: 'string' },
    }),
  },
})

export interface Candidate {
  file: string
  line: number
  severity: Severity
  kind: (typeof KINDS)[number]
  summary: string
  scenario: string
}

export interface Later {
  place: string
  problem: string
}

export interface Finding extends Candidate {
  check: 'confirmed' | 'plausible'
  evidence: string
}

export interface Objection {
  criterion: string
  problem: string
  evidence: string
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const oneOf = <T extends string>(v: unknown, values: readonly T[]): T | null =>
  values.includes(v as T) ? (v as T) : null
const list = (data: unknown, key: string): unknown[] => {
  const v = isRecord(data) ? data[key] : undefined
  return Array.isArray(v) ? v : []
}

/** 찾기의 구조화된 출력. 모양이 틀린 항목은 버린다. 출력이 객체가 아니면 null */
export function readFind(data: unknown): { candidates: Candidate[]; later: Later[] } | null {
  if (!isRecord(data)) return null
  const candidates: Candidate[] = []
  for (const c of list(data, 'candidates')) {
    if (!isRecord(c)) continue
    const severity = oneOf(c['severity'], SEVERITIES)
    const kind = oneOf(c['kind'], KINDS)
    const line = typeof c['line'] === 'number' && Number.isFinite(c['line']) ? c['line'] : 0
    const file = str(c['file'])
    const summary = str(c['summary'])
    if (!severity || !kind || !file || !summary) continue
    candidates.push({
      file,
      line: Math.max(0, Math.trunc(line)),
      severity,
      kind,
      summary,
      scenario: str(c['scenario']),
    })
  }
  const later: Later[] = []
  for (const l of list(data, 'later')) {
    if (!isRecord(l) || !str(l['place']) || !str(l['problem'])) continue
    later.push({ place: str(l['place']), problem: str(l['problem']) })
  }
  return { candidates, later }
}

/**
 * 확인의 구조화된 출력과 찾기의 후보로 남길 지적을 만든다 (D486): 틀림은 빼고, 확인이 답하지 않은 후보는 가능성으로 둔다
 * (가능성이 기본). 확인이 바꾼 심각도를 쓴다. 심각한 것부터, 같은 심각도 안에서는 정확성이 정리보다 앞이다 (D487).
 * 출력이 객체가 아니면 null
 */
export function readCheck(
  data: unknown,
  candidates: readonly Candidate[],
): { findings: Finding[]; objections: Objection[] } | null {
  if (!isRecord(data)) return null
  type Mark = { verdict: (typeof VERDICTS)[number]; severity: Severity | null; evidence: string }
  const marks = new Map<number, Mark>()
  for (const c of list(data, 'candidates')) {
    if (!isRecord(c) || typeof c['number'] !== 'number') continue
    const verdict = oneOf(c['verdict'], VERDICTS)
    if (!verdict) continue
    marks.set(c['number'], {
      verdict,
      severity: oneOf(c['severity'], SEVERITIES),
      evidence: str(c['evidence']),
    })
  }
  const findings: Finding[] = []
  candidates.forEach((c, i) => {
    const mark = marks.get(i + 1)
    if (mark?.verdict === 'refuted') return
    findings.push({
      ...c,
      severity: mark?.severity ?? c.severity,
      check: mark?.verdict ?? 'plausible',
      evidence: mark?.evidence ?? '',
    })
  })
  const objections: Objection[] = []
  for (const o of list(data, 'objections')) {
    if (!isRecord(o) || !str(o['criterion']) || !str(o['problem'])) continue
    objections.push({
      criterion: str(o['criterion']),
      problem: str(o['problem']),
      evidence: str(o['evidence']),
    })
  }
  return { findings: sortFindings(findings), objections }
}

/** 심각한 것부터, 같은 심각도 안에서는 정확성 지적이 정리 지적보다 앞이다 (D487). 같으면 찾은 차례다 */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  const rank = (f: Finding) => SEVERITIES.indexOf(f.severity) * 2 + KINDS.indexOf(f.kind)
  return findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .map((x) => x.f)
}

// ---------- 브리프 ----------

/**
 * skills/_review.md에서 `# <제목>` 아래의 글을 다음 `# ` 제목 전까지 잘라 낸다. 유형 구간은 부른 쪽이 먼저 고른다
 * (adapters/claude selectType). 없으면 오류다: 원본을 고친 실수를 리뷰를 돌릴 때 드러낸다
 */
export function reviewPart(text: string, title: 'Finder' | 'Checker'): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const start = lines.findIndex((l) => l === `# ${title}`)
  if (start < 0) throw new Error(`리뷰 지침에 \`# ${title}\`가 없음`)
  const end = lines.findIndex((l, i) => i > start && /^# /.test(l))
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .trim()
}

export interface ReviewDiff {
  /** 레포: 메인은 빈 글, 서브모듈은 그 경로 (D470) */
  repo: string
  /** 그 레포의 폴더 */
  dir: string
  /** 기준 커밋 */
  base: string
  /** 앱이 만든 diff 파일 */
  file: string
  /** 추적하지 않는 새 파일 (그 레포 폴더 기준 경로) */
  untracked: readonly string[]
}

export interface ReviewBrief {
  type: WorkType
  /** 이 Work의 worktree (메인 레포 폴더). 리뷰의 작업 폴더다 */
  worktree: string
  /** 승인된 intent의 글. 없으면 null */
  intent: string | null
  /** 마무리 단계의 context.md */
  contextPath: string
  /** 앞 단계들과 마무리 단계의 산출물: 화면 이름과 경로 */
  artifacts: readonly { title: string; path: string }[]
  diffs: readonly ReviewDiff[]
  /** 커스텀 유형의 리뷰 관점 (verify.md, D456, D495). 없으면 빈 글 */
  reviewPoints: string
}

function common(b: ReviewBrief): string[] {
  return [
    '## This Work',
    '',
    `- Worktree (the final code): \`${b.worktree}\``,
    `- \`context.md\` of the finishing step: \`${b.contextPath}\``,
    ...b.artifacts.map((a) => `- ${a.title}: \`${a.path}\``),
    '',
    '## Intent',
    '',
    b.intent ? fence(b.intent.trim()) : '없음',
    '',
    '## The change',
    '',
    ...b.diffs.flatMap((d) => [
      `- ${d.repo ? `Submodule \`${d.repo}\`` : 'Main repo'} in \`${d.dir}\`, from base commit \`${d.base}\`: diff file \`${d.file}\``,
      ...(d.untracked.length
        ? [`  - New files not added to git: ${d.untracked.map((u) => `\`${u}\``).join(', ')}`]
        : []),
    ]),
  ]
}

/** 찾기의 프롬프트: 지침의 `# Finder`(유형 구간을 고른 것), 이 Work, 유형의 리뷰 관점 */
export function findPrompt(finder: string, b: ReviewBrief): string {
  return [
    finder,
    '',
    ...common(b),
    ...(b.reviewPoints.trim()
      ? ['', "## This Work type's review points", '', b.reviewPoints.trim()]
      : []),
  ].join('\n')
}

/** 확인의 프롬프트: 지침의 `# Checker`, 이 Work, 찾기의 후보(번호), 판정표가 든 verification.md */
export function checkPrompt(
  checker: string,
  b: ReviewBrief,
  candidates: readonly Candidate[],
  verification: { path: string; text: string },
): string {
  return [
    checker,
    '',
    ...common(b),
    '',
    '## Candidates',
    '',
    ...(candidates.length
      ? candidates.map(
          (c, i) =>
            `${i + 1}. [${c.severity}, ${c.kind}] ${c.file}:${c.line} — ${c.summary}\n   실패 시나리오: ${c.scenario || '없음'}`,
        )
      : ['None. Check only the verdict table.']),
    '',
    `## The verdict table (\`${verification.path}\`)`,
    '',
    fence(verification.text.trim()),
  ].join('\n')
}

/** 리뷰 호출의 시스템 지시. 지침은 프롬프트에 있다 */
export const REVIEW_SYSTEM =
  'You are an independent reviewer for relay, a desktop app that runs coding agents step by step. Follow the instructions in the prompt. Only read files; never change them. Return only the structured output.'

// ---------- 결과 ----------

export interface CallRecord {
  kind: 'find' | 'check'
  ms: number
  cost_usd: number | null
  usage: { input: number; output: number; cacheRead: number; cacheCreation: number } | null
  error: string | null
  /** 찾기의 후보 수, 확인의 남은 지적 수 */
  count?: number
}

export interface ReviewResult {
  codeReview: boolean
  /** 찾기가 실패했으면 그 까닭 */
  findError: string | null
  /** 확인이 실패했으면 그 까닭 */
  checkError: string | null
  findings: readonly Finding[]
  later: readonly Later[]
  objections: readonly Objection[]
}

/** 실패한 호출의 까닭 한 줄 (review.finished의 error). 모두 성공했으면 undefined */
export function reviewError(r: ReviewResult): string | undefined {
  const parts = [
    r.findError ? `코드 리뷰: ${r.findError}` : null,
    r.checkError ? `확인: ${r.checkError}` : null,
  ].filter((p): p is string => p !== null)
  return parts.length ? parts.join(' / ') : undefined
}

/**
 * 결과 글 (D495): 다시 연 마무리 세션과 사람이 읽는다. 절은 `## 코드 리뷰`, `## 지적`, `## 나중에 정리할 곳`, `## 판정표 이의`다.
 * 확인이 실패하면 찾기의 후보를 확인하지 않은 채(가능성) 옮겨 적는다
 */
export function reviewMarkdown(r: ReviewResult): string {
  const review = !r.codeReview
    ? '끔 — 판정표만 확인했습니다 (code_review 설정).'
    : r.findError
      ? `실패 — ${r.findError}`
      : '켬'
  const check = r.checkError
    ? `\n\n확인 실패 — ${r.checkError}. 아래 지적은 확인을 거치지 않았습니다.`
    : ''
  const findings = r.findings.length
    ? r.findings.flatMap((f, i) => [
        `${i + 1}. [${f.severity}] ${f.file}:${f.line} — ${f.summary} (${VERDICT_LABEL[f.check]})`,
        `   실패 시나리오: ${f.scenario || '없음'}`,
        ...(f.evidence ? [`   근거: ${f.evidence}`] : []),
      ])
    : ['없음']
  const later = r.later.length ? r.later.map((l) => `- ${l.place} — ${l.problem}`) : ['없음']
  const objections = r.objections.length
    ? r.objections.map(
        (o) => `- ${o.criterion} — ${o.problem}${o.evidence ? ` (근거: ${o.evidence})` : ''}`,
      )
    : ['없음']
  return [
    '# 독립 리뷰 결과',
    '',
    'relay가 띄운 독립 리뷰가 쓴 글입니다. 지적은 `verification.md`의 `## 리뷰 지적`으로 옮기고, 판정표 이의에는 하나씩 답합니다.',
    '',
    '## 코드 리뷰',
    '',
    `${review}${check}`,
    '',
    '## 지적',
    '',
    ...findings,
    '',
    '## 나중에 정리할 곳',
    '',
    ...later,
    '',
    '## 판정표 이의',
    '',
    ...objections,
    '',
  ].join('\n')
}

/** 리뷰 뒤 전할 말의 최대 글자 수 (D529) */
export const REVIEW_NOTE_MAX = 2000

/**
 * 다시 연 마무리 세션의 첫 입력 (D496). 독립 리뷰 중에 사람이 남긴 말이 있으면 뒤에 붙인다 (D529): 사람이 터미널에 한
 * 말과 같게 다루라고 알린다. 줄바꿈은 실행 인자에서 흐트러지지 않게 " / "로 잇는다
 */
export function reviewResumePrompt(resultPath: string, note?: string): string {
  const base =
    `relay: 독립 리뷰가 끝났습니다. ${resultPath}를 읽고 절차의 '독립 리뷰를 받은 뒤' 순서대로 이어 하세요. ` +
    '리뷰를 다시 요청하지 마세요.'
  const said = note
    ?.split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' / ')
  return said
    ? `${base} 사람이 리뷰하는 동안 남긴 말이 있습니다. 터미널에서 들은 말처럼 다루세요(고칠 점이면 리뷰 지적과 함께 ` +
        `그 자리에서 고치고 결정 기록에 사람의 요청으로 남깁니다): "${said}"`
    : base
}
