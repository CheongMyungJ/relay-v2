// 지식 관리의 순수 로직 (D283~D323, I69, I72, I74). 항목 파일의 읽고 쓰기, 경로와 용어의 겹침, 넣을 지식 고르기·자르기·
// 렌더(D311, D312, D315), 낡음 분류(D316), 후보 모으기(D283, D296, D299, D304, D313, D317, D318), 겹치는 기존 항목(D302),
// 채택 결과 계산(D287~D289, D308, D310, D322), 공유 대기 판단(I74). 파일과 git은 adapters/knowledge가, 조립은 main이 한다.
import { stringify } from 'yaml'
import type { AnyHandoff, TaskNode } from '../shared/contracts'
import {
  KNOWLEDGE_KINDS,
  KNOWLEDGE_KIND_LABEL,
  type CandidateEdit,
  candidateChoice,
  candidateProblem,
  editedCandidate,
  entryChoice,
  normalizePath,
  pendingAction,
  type KnowledgeCandidateView,
  type KnowledgeChoices,
  type KnowledgeEntry,
  type KnowledgeFeedbackView,
  type KnowledgeKind,
  type KnowledgePlan,
  type KnowledgeRefView,
  type KnowledgeReview,
  type KnowledgeScope,
  type KnowledgeSource,
} from '../shared/knowledge'
import type { FormatIssue, TaskRecord, WorkState } from '../shared/work'

export {
  candidateChoice,
  candidateProblem,
  defaultCandidateChoice,
  editedCandidate,
  entryChoice,
  normalizePath,
  pendingAction,
  planLine,
} from '../shared/knowledge'
import {
  KNOWLEDGE_SECTIONS,
  checkKnowledgeFile,
  handoffV2,
  normalizeText,
  sectionText,
} from './validate'

/** 레포 안 지식 폴더의 기본값 (D305) */
export const DEFAULT_KNOWLEDGE_DIR = 'docs/knowledge/'

/** `참고 지식` 절의 분량 기준 기본값 (D312, D315 (4)) */
export const DEFAULT_KNOWLEDGE_INJECT_CHARS = 1500

/** 지식을 끄는 환경 변수 (I84). 평가와 개발에만 쓰고 화면에 없다 */
export const KNOWLEDGE_ENV = 'RELAY_KNOWLEDGE'

/** 환경 변수로 지식이 꺼져 있는가 (I84): RELAY_KNOWLEDGE=off */
export function knowledgeOff(env: Readonly<Record<string, string | undefined>>): boolean {
  return (env[KNOWLEDGE_ENV] ?? '').trim().toLowerCase() === 'off'
}

/** 종류 이름의 정규식 조각 (`domain|recipe|…`). 종류 목록은 shared/knowledge 한 곳에 둔다 */
const KIND_ALT = KNOWLEDGE_KINDS.join('|')

/** 지식 id의 모양 (D320) */
export const ENTRY_ID = new RegExp(`^(${KIND_ALT})-[0-9a-z]{8}$`)

/** 새 항목 id (D320 (1)): <kind>-<무작위 8자>. random은 [0-9a-z] 8자를 준다 */
export function newEntryId(kind: KnowledgeKind, random: () => string): string {
  const tail = random()
    .toLowerCase()
    .replace(/[^0-9a-z]/g, '')
    .padEnd(8, '0')
    .slice(0, 8)
  return `${kind}-${tail}`
}

// ---------- 지식 폴더 (D305) ----------

/**
 * 지식 폴더 설정값을 맞춘다 (D305): 레포 안의 상대 경로이고, 앞의 `./`와 끝의 `/`를 정리해 `a/b/` 꼴로 둔다. 절대 경로,
 * `..`, `.relay/`·`.git/` 밑은 받지 않는다. 받지 않으면 오류 문구를 돌려준다
 */
export function normalizeKnowledgeDir(
  raw: string,
): { ok: true; dir: string } | { ok: false; error: string } {
  const s = raw.trim().replace(/\\/g, '/')
  if (!s) return { ok: false, error: '지식 폴더가 비어 있음' }
  if (/^(?:\/|[A-Za-z]:)/.test(s))
    return { ok: false, error: '지식 폴더는 레포 안의 상대 경로여야 함' }
  const parts = s.split('/').filter((p) => p && p !== '.')
  if (parts.length === 0) return { ok: false, error: '지식 폴더가 레포 루트일 수 없음' }
  if (parts.includes('..')) return { ok: false, error: '지식 폴더에 `..`를 쓸 수 없음' }
  const first = parts[0]?.toLowerCase()
  if (first === '.relay' || first === '.git') {
    return { ok: false, error: '`.relay/`와 `.git/` 밑은 지식 폴더로 쓸 수 없음' }
  }
  return { ok: true, dir: `${parts.join('/')}/` }
}

/** 지식 폴더 안 항목 파일의 상대 경로: <dir><kind>/<id>.md (D320 (1)) */
export function entryPath(dir: string, kind: KnowledgeKind, id: string): string {
  return `${dir}${kind}/${id}.md`
}

/** 지식 폴더의 README (D306, D321). 처음 만들 때 한 번만 쓴다 */
export const KNOWLEDGE_README_FILE = 'README.md'

export function knowledgeReadme(): string {
  return [
    '# 지식',
    '',
    '이 폴더는 relay가 Work에서 모은 팀 지식이다. 사람이 Work 완료 화면에서 거른 것만 PR에 실려 코드와 함께 리뷰되고 머지된다.',
    '항목마다 Markdown 파일 하나이고, 머리글에 종류, 경로, 용어, 상태, 경로의 내용 해시, 출처가 있다. 본문은 `# <규칙>`과 이유, 코드불가(왜 코드만 봐서는 알 수 없나), 유인(모르면 할 법한 잘못된 변경)이다.',
    '',
    '## 종류',
    '',
    '- `domain/`: 도메인 규칙. 사람이 정한 동작 규칙',
    '- `recipe/`: 검증 레시피. 테스트 명령, 재현법, 기준 커밋의 실패',
    '- `failure/`: 실패 부류. 되풀이되는 실패와 그 점검',
    '- `constraint/`: 제약. 코드에 보이지 않는 규칙과 외부 호환',
    '- `decision/`: 결정. 기각한 대안과 하지 않기로 한 것',
    '- `structure/`: 구조 사실. 여러 모듈에 걸쳐 함께 읽어야 하는 관계와 용어',
    '',
    '## 읽는 법',
    '',
    '- `status: superseded`인 항목은 `superseded_by`의 항목으로 대체됐다. 바꿀 때는 고치지 않고 대체한다.',
    '- relay는 task를 시작할 때 단계와 경로, 용어로 항목을 골라 넣는다. 경로의 내용이 바뀌었으면 "재확인 필요"를 붙인다.',
    '- 이 폴더는 relay 앱이 쓴다. 고칠 것은 PR 리뷰 코멘트로 남기면 PR 대응에서 고친다.',
    '',
  ].join('\n')
}

// ---------- 항목 파일 (D306, D320) ----------

/** 항목의 머리글 차례 (D320 (2)) */
function headerOf(e: KnowledgeEntry): Record<string, unknown> {
  return {
    id: e.id,
    kind: e.kind,
    subkind: e.subkind,
    status: e.status,
    superseded_by: e.superseded_by,
    paths: e.paths,
    terms: e.terms,
    hashes: e.hashes,
    source: { work: e.source.work, task: e.source.task, by: e.source.by },
  }
}

/** 한 줄로 편다. 규칙 제목과 목록에 쓴다 */
function oneLine(s: string): string {
  return s.replace(/\s*\n\s*/g, ' ').trim()
}

/** 항목 파일의 내용 (D320): YAML 머리글, `# <규칙>`, 이유·코드불가·유인 */
export function renderEntry(e: KnowledgeEntry): string {
  const yaml = stringify(headerOf(e), { lineWidth: 0 }).trimEnd()
  const section = (title: string, text: string) => [`## ${title}`, '', text.trim() || '없음', '']
  return [
    '---',
    yaml,
    '---',
    `# ${oneLine(e.rule)}`,
    '',
    ...section(KNOWLEDGE_SECTIONS[0], e.why),
    ...section(KNOWLEDGE_SECTIONS[1], e.not_in_code),
    ...section(KNOWLEDGE_SECTIONS[2], e.incentive),
  ].join('\n')
}

export type ParsedEntry =
  | { ok: true; entry: KnowledgeEntry; warnings: FormatIssue[] }
  | { ok: false; errors: FormatIssue[] }

/** 항목 파일을 읽는다 (D320). 머리글은 knowledge-entry 스키마로 검사한다. file은 메시지에 쓸 이름이다 */
export function parseEntry(text: string, file: string): ParsedEntry {
  const c = checkKnowledgeFile(text, file)
  if (!c.value || c.rule === null) return { ok: false, errors: c.errors }
  const h = c.value
  const body = normalizeText(c.body)
  const part = (name: string) => sectionText(body, name) ?? ''
  return {
    ok: true,
    warnings: c.warnings,
    entry: {
      id: h.id,
      kind: h.kind,
      subkind: h.subkind,
      status: h.status,
      superseded_by: h.superseded_by,
      paths: [...h.paths],
      terms: [...h.terms],
      hashes: { ...h.hashes },
      source: { work: h.source.work, task: h.source.task, by: h.source.by },
      rule: c.rule,
      why: part(KNOWLEDGE_SECTIONS[0]),
      not_in_code: part(KNOWLEDGE_SECTIONS[1]),
      incentive: part(KNOWLEDGE_SECTIONS[2]),
    },
  }
}

// ---------- 경로와 용어 (D311, I74) ----------

/** `파일:심볼`의 파일 (D320 (3)). 심볼이 없으면 그대로다 */
export function pathFile(p: string): string {
  const n = normalizePath(p)
  const i = n.indexOf(':')
  return i > 0 ? n.slice(0, i) : n
}

function isSymbol(p: string): boolean {
  return normalizePath(p).indexOf(':') > 0
}

/** a가 b의 조상 디렉터리이거나 같다 */
function within(dir: string, p: string): boolean {
  return p === dir || p.startsWith(`${dir}/`)
}

/**
 * 두 경로가 겹치는가 (I74): 같은 경로, 디렉터리와 그 아래 경로(조상 디렉터리 포함), 심볼과 그 파일. 다른 심볼끼리는 같은
 * 파일이어도 겹치지 않는다
 */
export function pathsOverlap(a: string, b: string): boolean {
  const x = normalizePath(a)
  const y = normalizePath(b)
  if (!x || !y) return false
  if (x === y) return true
  if (isSymbol(x) && isSymbol(y)) return false
  const fx = pathFile(x)
  const fy = pathFile(y)
  return within(fx, fy) || within(fy, fx)
}

/** 같은 파일을 가리키는 경로인가 (D326). 디렉터리와 그 아래 파일은 아니고, 둘 다 심볼이면 같은 심볼이어야 한다 */
function sameFile(a: string, b: string): boolean {
  const x = normalizePath(a)
  const y = normalizePath(b)
  if (!x || !y) return false
  if (isSymbol(x) && isSymbol(y)) return x === y
  return pathFile(x) === pathFile(y)
}

/**
 * 비슷한 후보인가 (D326): 종류와 갈래가 같고, 같은 파일을 가리키는 경로가 있고, 용어가 하나 이상 겹친다. 경로가 겹치기만
 * 하는 것(디렉터리와 그 아래)이나 같은 파일의 다른 규칙(용어가 다름)은 비슷하지 않다
 */
export function similarCandidates(
  a: {
    kind: KnowledgeKind | null
    subkind: string | null
    paths: readonly string[]
    terms: readonly string[]
  },
  b: {
    kind: KnowledgeKind | null
    subkind: string | null
    paths: readonly string[]
    terms: readonly string[]
  },
): boolean {
  if (!a.kind || a.kind !== b.kind || (a.subkind ?? null) !== (b.subkind ?? null)) return false
  if (!a.paths.some((x) => b.paths.some((y) => sameFile(x, y)))) return false
  const terms = new Set(a.terms.map(normalizeTerm).filter(Boolean))
  return b.terms.some((t) => terms.has(normalizeTerm(t)))
}

/** 항목 경로 가운데 known과 겹치는 가장 긴(가장 구체적인) 경로의 길이. 없으면 0 (D315 (2)) */
export function overlapLength(entryPaths: readonly string[], known: readonly string[]): number {
  let best = 0
  for (const p of entryPaths) {
    if (known.some((k) => pathsOverlap(p, k))) best = Math.max(best, normalizePath(p).length)
  }
  return best
}

/** 용어를 맞춘다 (I74): NFKC, 소문자, 공백 정리 */
export function normalizeTerm(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** 용어가 글에 들어 있는가 (D311, I74) */
export function termsMatch(terms: readonly string[], text: string): boolean {
  const t = normalizeTerm(text)
  return terms.some((term) => {
    const n = normalizeTerm(term)
    return n.length > 0 && t.includes(n)
  })
}

/** 여러 낱말 용어의 낱말(두 글자 이상) 가운데 하나가 글에 들어 있는가. intake의 겹치지 않은 도메인 규칙의 차례에만 쓴다 (지식 탐색 K3) */
export function termPartsMatch(terms: readonly string[], text: string): boolean {
  const t = normalizeTerm(text)
  return terms.some((term) => {
    const words = normalizeTerm(term).split(' ')
    return words.length > 1 && words.some((w) => [...w].length >= 2 && t.includes(w))
  })
}

/**
 * 글에 적힌 경로 (D315 (1)): 요청과 intent에서 경로처럼 보이는 낱말(슬래시가 있거나 확장자가 있는 것)을 뽑는다. 백틱 안의
 * 것도 같다. 지식 폴더 밖의 레포 경로만 뜻이 있어 여기서는 모양만 본다
 */
const PATH_WORD =
  /[\w.@-]+(?:\/[\w.@-]+)+\/?(?::[A-Za-z_$][\w$]*)?|\b[\w-]+\.[A-Za-z]{1,6}(?::[A-Za-z_$][\w$]*)?\b/g

export function pathsInText(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(PATH_WORD)) {
    const raw = m[0]
    // 주소(https://…)와 버전 번호는 경로가 아니다
    if (text.slice(Math.max(0, m.index - 3), m.index) === '://') continue
    if (/^\d+(\.\d+)+$/.test(raw)) continue
    const p = normalizePath(raw.replace(/[.,;:)]+$/, ''))
    if (p && !p.includes('..')) out.add(p)
  }
  return [...out]
}

// ---------- 낡음 (D316, D317, I72) ----------

/** 경로의 지금 해시. 없는 경로는 null이다 (I72) */
export type CurrentHashes = Readonly<Record<string, string | null>>

/**
 * 항목이 재확인 필요인가 (D316): 묶인 경로 가운데 지금 해시가 적힌 해시와 다른 것이 있다. 해시가 적히지 않은 경로는 "적을 때
 * 없던 경로"로 보아, 지금도 없으면 바뀐 것이 없다. 그래서 지워진 경로를 [그대로 맞음]으로 확인하면(해시를 적지 못함) 다시
 * 재확인 필요가 되지 않고, 그 경로에 파일이 다시 생기면 재확인 필요다 (지식 탐색 K5)
 */
export function isStale(entry: KnowledgeEntry, current: CurrentHashes): boolean {
  return entry.paths.some((p) => {
    const now = current[normalizePath(p)] ?? null
    const was = entry.hashes[normalizePath(p)] ?? entry.hashes[p] ?? null
    return now !== was
  })
}

/** 항목들의 경로를 맞춘 목록. 해시를 구할 경로다 */
export function entryPaths(entries: readonly Pick<KnowledgeEntry, 'paths'>[]): string[] {
  return [...new Set(entries.flatMap((e) => e.paths.map(normalizePath)).filter(Boolean))]
}

/** 항목의 해시를 지금 해시로 새로 적는다 (D320 (4), D323). 없는 경로는 적지 않는다 */
export function withHashes(entry: KnowledgeEntry, current: CurrentHashes): KnowledgeEntry {
  const hashes: Record<string, string> = {}
  for (const p of entry.paths) {
    const n = normalizePath(p)
    const h = current[n]
    if (h) hashes[n] = h
  }
  return { ...entry, hashes }
}

// ---------- 모으기와 같은 id (I74) ----------

/** 고를 수 있는 항목: 항목, 있는 곳, 전체 파일의 경로, 재확인 필요 */
export interface PoolEntry {
  entry: KnowledgeEntry
  scope: KnowledgeScope
  /** 전체 파일의 경로. context.md와 화면에 보인다 */
  file: string
  stale: boolean
  /**
   * 공유 대기나 나만 항목의 묶인 경로가 이 Work의 코드(HEAD)와 다르다 (D327). 출처 Work가 아직 기준에 없을 수 있어(머지 전,
   * [완료만]) 재확인 필요로 보지 않고 "출처 Work의 코드 기준"으로 넣는다
   */
  ahead?: boolean
  /** 공유 대기가 열린 PR에 실려 있으면 그 PR (D310 (3)) */
  carriedPr?: number | null
}

/** 같은 id면 앞의 것을 쓰는 차례 (I74): 이 Work가 실은 것, 공유 대기, 머지된 팀 지식. 나만은 따로 id를 가진다 */
const SCOPE_ORDER: Readonly<Record<KnowledgeScope, number>> = {
  carried: 0,
  pending: 1,
  mine: 2,
  team: 3,
}

/** 같은 id의 항목을 하나로 (I74). 낡음은 머지된 팀 지식을 쓸 때만 둔다 (D316) */
export function mergePool(entries: readonly PoolEntry[]): PoolEntry[] {
  const byId = new Map<string, PoolEntry>()
  for (const e of entries) {
    const prev = byId.get(e.entry.id)
    if (!prev || SCOPE_ORDER[e.scope] < SCOPE_ORDER[prev.scope]) byId.set(e.entry.id, e)
  }
  return [...byId.values()].map((e) => (e.scope === 'team' ? e : { ...e, stale: false }))
}

/**
 * worktree의 지식 폴더 항목을 나눈다 (I74): Work의 기준 커밋과 내용이 같으면 머지된 팀 지식, 다르거나 없던 것이면 이
 * Work가 PR에 실은 것이다
 */
export function worktreeScope(text: string, baseText: string | null): 'team' | 'carried' {
  return baseText !== null && normalizeText(baseText) === normalizeText(text) ? 'team' : 'carried'
}

/**
 * 공유 대기 사본이 relay 밖에서 머지됐는가 (D310 (4), I74): Work의 기준 커밋에 같은 경로의 파일이 있고 내용이 같다.
 * worktree로 판정하지 않는다
 */
export function pendingMerged(pendingText: string, baseText: string | null): boolean {
  return baseText !== null && normalizeText(baseText) === normalizeText(pendingText)
}

// ---------- 넣기 (D286, D311, D312, D315) ----------

/** 단계마다 넣을 종류 (설계 5.7.3) */
export const STAGE_KINDS: Readonly<Record<TaskNode, readonly KnowledgeKind[]>> = {
  intake: ['domain', 'recipe', 'constraint'],
  fix: ['failure', 'recipe', 'structure', 'constraint'],
  design: ['decision', 'constraint', 'domain'],
  implement: ['constraint'],
  refactor: ['constraint', 'decision', 'structure', 'failure'],
  verify: ['failure', 'constraint'],
  respond: ['recipe', 'failure', 'constraint'],
}

/** intake의 제약은 외부 호환만 넣는다 (B.4: "외부 호환 제약") */
function stageAccepts(node: TaskNode, e: KnowledgeEntry): boolean {
  if (!STAGE_KINDS[node].includes(e.kind)) return false
  if (node === 'intake' && e.kind === 'constraint') return e.subkind === 'compat'
  return true
}

export interface SelectInput {
  node: TaskNode
  pool: readonly PoolEntry[]
  /** 이번 task가 건드릴 경로 (D315 (1)) */
  paths: readonly string[]
  /** 요청과 intent의 글 (D311) */
  text: string
  /** 분량 기준 (D312, D315 (4)) */
  limit: number
  /** 자른 것이 있을 때 안내할 지식 폴더 (D312) */
  dirs: readonly string[]
}

export interface Selected {
  entry: PoolEntry
  /** 경로가 겹친 길이. 용어로만 겹쳤으면 0 */
  overlap: number
}

/**
 * 넣을 지식을 고른다 (D311, D315 (2), I74). 단계별 종류 가운데 유효한 항목만, 경로가 겹치거나 용어가 글에 있는 것.
 * 차례: 외부 호환 제약과 도메인 규칙, 경로가 겹친 것, 용어로만 겹친 것. 같은 묶음 안에서는 경로가 겹친 것, 겹친 경로가 긴
 * 것, id 순이다
 */
export function selectKnowledge(input: Omit<SelectInput, 'limit' | 'dirs'>): Selected[] {
  const picked: (Selected & { group: number })[] = []
  for (const p of input.pool) {
    const e = p.entry
    if (e.status !== 'active' || !stageAccepts(input.node, e)) continue
    const overlap = overlapLength(e.paths, input.paths)
    const termHit = termsMatch(e.terms, input.text)
    if (overlap === 0 && !termHit) {
      // intake는 경로를 거의 모르고 요청은 지식과 다른 말(부가세 ↔ VAT, tax)을 쓰기 쉽다. 도메인 규칙은 겹치지 않아도 맨 뒤에
      // 넣어 분량 안에서 에이전트가 고르게 한다. 다시 묻고 다른 답을 받는 것을 막는다 (지식 탐색 K3)
      // 그 가운데 여러 낱말 용어의 한 낱말이 글에 있는 것("오류 문구"의 "문구")을 먼저 둔다
      // 외부 호환 제약도 같다: 코드를 고치기 전에 intent에 옮겨야 fix가 지킨다 (D328)
      if (input.node === 'intake' && (e.kind === 'domain' || e.kind === 'constraint'))
        picked.push({ entry: p, overlap, group: termPartsMatch(e.terms, input.text) ? 3 : 4 })
      continue
    }
    const first = e.kind === 'domain' || (e.kind === 'constraint' && e.subkind === 'compat')
    picked.push({ entry: p, overlap, group: first ? 0 : overlap > 0 ? 1 : 2 })
  }
  picked.sort(
    (a, b) =>
      a.group - b.group ||
      Number(b.overlap > 0) - Number(a.overlap > 0) ||
      b.overlap - a.overlap ||
      a.entry.entry.id.localeCompare(b.entry.entry.id),
  )
  return picked.map(({ entry, overlap }) => ({ entry, overlap }))
}

/** `참고 지식` 절의 머리 (D315 (3)) */
export const KNOWLEDGE_NOTE =
  '참고용이다. 지금 코드나 사람의 말과 다르면 그쪽이 맞고, 다른 점을 handoff의 `knowledge_feedback`에 적는다 (D315, D318). ' +
  '항목 id는 파일 이름(`<id>.md`)이다.'

/**
 * 한 줄 (I74): `- [종류] 규칙 (경로) — <파일 경로>`, 재확인 필요면 끝에 "(재확인 필요)", 출처 Work의 코드 기준이면 끝에
 * 그 Work (D327)
 */
export function knowledgeLine(p: PoolEntry): string {
  const e = p.entry
  const paths = e.paths.length ? ` (${e.paths.join(', ')})` : ''
  const stale = p.stale ? ' (재확인 필요)' : ''
  const ahead = !p.stale && p.ahead ? ` ${aheadNote(e.source.work)}` : ''
  return `- [${KNOWLEDGE_KIND_LABEL[e.kind]}] ${oneLine(e.rule)}${paths} — ${p.file}${stale}${ahead}`
}

/** 출처 Work의 코드 기준인 항목의 표시 (D327). 스킬은 이 말로 알아본다 */
export function aheadNote(work: string): string {
  return `(출처 Work ${work}의 코드 기준: 이 Work의 코드와 다름. 그 Work가 아직 기준에 없을 수 있음)`
}

/**
 * `참고 지식` 절의 본문 (D286, D312, D315). 고른 것이 없으면 "없음"이다. 분량 기준을 넘으면 항목 가운데서 자르지 않고
 * 그 앞까지 넣은 뒤 지식 폴더를 안내한다
 */
export function renderKnowledge(input: SelectInput): { text: string; ids: string[] } {
  const selected = selectKnowledge(input)
  if (selected.length === 0) return { text: '없음', ids: [] }
  const head = KNOWLEDGE_NOTE
  const lines: string[] = []
  const ids: string[] = []
  let size = [...head].length
  for (const s of selected) {
    const line = knowledgeLine(s.entry)
    const n = [...line].length + 1
    if (lines.length > 0 && size + n > input.limit) break
    lines.push(line)
    ids.push(s.entry.entry.id)
    size += n
  }
  const cut = selected.length - lines.length
  const tail = cut
    ? [
        '',
        `분량 기준(${input.limit}자)에서 ${cut}건을 뺐다. 더 필요하면 지식 폴더에서 찾는다: ${input.dirs.join(', ')}`,
      ]
    : []
  return { text: [head, '', ...lines, ...tail].join('\n'), ids }
}

// ---------- 코드로 알 수 있는 후보 (D297, 지식 탐색 K22) ----------

/** 레시피 규칙의 시험 명령 */
const TEST_COMMAND = /npm (?:run )?test|node --test|pnpm test|yarn test|내장 (?:테스트 )?러너/i
/** 레시피 규칙의 시험 파일 경로와 백틱 안 명령 */
const TEST_PATH = /[\w./*-]*\.(?:m?js|cjs|ts|tsx|json)(?![A-Za-z0-9])|\btest\/\S*|`[^`]*`/gi
/** 시험 실행법을 말할 때 늘 붙는 낱말. 조사를 떼고 견준다 */
const TEST_BOILERPLATE = new Set(
  (
    '테스트 시험 파일 돌리고 돌린다 돌려 돌려서 돌리며 실행 실행한다 실행하고 실행하며 실행해 있다 있고 있으며 있음 ' +
    '다룬다 다루고 현재 기존 아래 위치 디렉터리 단위 전체 모두 한다 하고 그리고 및'
  ).split(' '),
)
const JOSA = /(?:으로|에는|이다|로|는|은|를|을|가|이|에|와|과|만|도|다)$/

/** 시험 명령, 시험 파일, 늘 붙는 낱말을 빼고 남는 낱말. 셋 이하면 시험 실행법만 말하는 레시피로 본다 (K22) */
export function recipeSubstance(rule: string): string[] {
  const s = rule
    .replace(new RegExp(TEST_COMMAND.source, 'gi'), ' ')
    .replace(TEST_PATH, ' ')
    .replace(/[()[\]{},.:;·"'`<>]/g, ' ')
  return s.split(/\s+/).filter((w) => {
    if (!w) return false
    const stem = w.replace(JOSA, '')
    return !TEST_BOILERPLATE.has(w) && !TEST_BOILERPLATE.has(stem) && [...stem].length > 1
  })
}

/** 코드불가 칸이 스스로 코드에 있다고 말함 */
const ADMITS_IN_CODE = /이미 있|약한 후보|참고용|재사용용|안내용|절차로 남김|코드에 있(?:으나|지만)/
/** 코드불가 칸이 가리키는 레포 안 문서·설정 */
const POINTS_TO_FILE = /package\.json|readme|makefile|스크립트/i
/** 가리킨 곳에 없다고 말함("package.json에 없음") */
const NOT_IN_FILE = /(?:package\.json|readme|makefile|스크립트)[^.,;]*?(?:없|안 나|않)/i
/** 그래도 코드로 알 수 없는 까닭: 실행 환경, 실패 사실, 적힌 것과 다름 */
const NOT_FROM_FILE = /환경|버전|실패|잘못|틀|다르|다른 이름/

/**
 * 코드로 알 수 있는 후보인가 (D297, 지식 탐색 K22). 까닭을 돌려주고 아니면 null이다. 사람 결정에서 다듬은 후보와 기존 항목을
 * 고치는 후보(supersedes)는 보지 않는다. 자동으로 버리지 않고 채택 안 함을 기본으로 둘 때 쓴다(사람이 고르면 채택)
 */
export function inCodeReason(c: {
  kind: KnowledgeKind | null
  rule: string
  not_in_code: string
}): string | null {
  const nic = c.not_in_code
  // 코드불가 칸이 실행 환경, 실패 사실, 적힌 것과 다름을 말하면 코드로 알 수 없는 것이다
  if (NOT_FROM_FILE.test(nic)) return null
  if (c.kind === 'recipe' && TEST_COMMAND.test(c.rule) && recipeSubstance(c.rule).length <= 3) {
    return '시험 명령만 말하는 레시피'
  }
  if (ADMITS_IN_CODE.test(nic)) return '코드불가 칸이 코드에 있다고 적음'
  const file = POINTS_TO_FILE.exec(nic)
  if (file && !NOT_IN_FILE.test(nic)) return `코드불가 칸이 ${file[0]}를 가리킴`
  return null
}

// ---------- 후보 모으기 (D283, D296, D299, D304, D313, D317, D318) ----------

/** 후보를 모을 task 하나: 폐기되지 않은 task의 형식 검사 결과 */
export interface CandidateTask {
  taskId: string
  node: TaskNode
  /** 검사한 형식 버전 (I70). 2일 때만 지식 필드를 읽는다 */
  version: number
  /** handoff 머리글이 스키마를 통과했을 때의 값 */
  header: AnyHandoff | null
}

/**
 * 후보를 모을 task (D284, D304, B.5 2): 폐기되지 않은 task 가운데 pipeline은 파이프라인 task, respond는 PR 대응 task다.
 * 폐기한 task의 후보는 빠진다(5.4와 같은 규칙). 승인됐거나 승인을 기다리는 task만 본다
 */
export function reviewTaskIds(
  work: Pick<WorkState, 'tasks'>,
  which: 'pipeline' | 'respond',
): TaskRecord[] {
  return work.tasks.filter(
    (t) =>
      t.status !== 'discarded' &&
      (which === 'respond' ? t.node === 'respond' : t.node !== 'respond') &&
      (t.status === 'approved' ||
        t.status === 'awaiting_approval' ||
        t.status === 'idle' ||
        t.status === 'session_ended'),
  )
}

/** 거르기의 사실: 모은 후보와 기존 항목 */
export interface ReviewInput {
  tasks: readonly CandidateTask[]
  /** 고를 수 있는 기존 항목 (mergePool을 거친 것) */
  pool: readonly PoolEntry[]
  /** 이 Work가 바꾼 경로 (기준 커밋 → HEAD). 재확인 항목을 고른다 (D317) */
  changed: readonly string[]
  share: boolean
  dir: string
  /** 함께 실릴 공유 대기를 보인다: [PR 생성]을 할 수 있는 Work (D308) */
  offerPending: boolean
}

/** 기존 항목의 화면 모양 */
export function refView(p: PoolEntry): KnowledgeRefView {
  return {
    id: p.entry.id,
    scope: p.scope,
    kind: p.entry.kind,
    kindLabel: KNOWLEDGE_KIND_LABEL[p.entry.kind],
    rule: p.entry.rule,
    paths: p.entry.paths,
    terms: p.entry.terms,
    file: p.file,
    carriedPr: p.carriedPr ?? null,
    stale: p.stale,
  }
}

/** 겹치는 기존 항목 (D302): 같은 종류이고 경로나 용어가 겹치는 유효한 항목 */
export function overlappingEntries(
  c: { kind: KnowledgeKind | null; paths: readonly string[]; terms: readonly string[] },
  pool: readonly PoolEntry[],
): PoolEntry[] {
  if (!c.kind) return []
  const terms = new Set(c.terms.map(normalizeTerm))
  return pool.filter((p) => {
    const e = p.entry
    if (e.status !== 'active' || e.kind !== c.kind) return false
    const pathHit = e.paths.some((x) => c.paths.some((y) => pathsOverlap(x, y)))
    const termHit = e.terms.some((t) => terms.has(normalizeTerm(t)))
    return pathHit || termHit
  })
}

/**
 * Work 완료 화면의 지식 칸 (I75). 폐기한 task는 넘기지 않는다(main). v1 task는 사람 결정만 올린다(I70). 사람 결정은 그
 * what을 decision에 적은 에이전트 후보와 묶고, 묶이지 않은 것은 다듬지 않은 사람 결정이다(D299, D304). supersedes는 그
 * 항목과 짝짓고, 같은 id의 틀렸다는 보고도 그 짝에 붙인다(D318)
 */
export function reviewKnowledge(input: ReviewInput): KnowledgeReview {
  const byId = new Map(input.pool.map((p) => [p.entry.id, p]))
  const candidates: KnowledgeCandidateView[] = []
  const feedback = new Map<string, KnowledgeFeedbackView>()
  // 사람 결정은 Work의 task 모두에서 모은다. 뒤 task(예: verify)가 앞 task(intake)의 결정을 다듬어 올리기도 한다
  const humanDecisions = new Set(
    input.tasks.flatMap((t) =>
      (t.header?.decisions ?? []).filter((d) => d.by === 'human').map((d) => d.what.trim()),
    ),
  )
  // 결정마다 처음 올린 후보의 key. 같은 결정의 뒤 후보는 그 key를 가리키고 채택 안 함이 기본이다 (D324)
  const first = new Map<string, string>()
  for (const t of input.tasks) {
    const header = t.header
    if (!header) continue
    const v2 = handoffV2(header, t.version)
    const agent = v2?.knowledge_candidates ?? []
    agent.forEach((c, i) => {
      const decision = c.decision?.trim() || null
      const human = decision !== null && humanDecisions.has(decision)
      const key = `${t.taskId}#k${i + 1}`
      const sameDecisionAs = human && decision ? (first.get(decision) ?? null) : null
      if (human && decision && !sameDecisionAs) first.set(decision, key)
      const target = c.supersedes ? byId.get(c.supersedes) : undefined
      candidates.push({
        key,
        taskId: t.taskId,
        node: t.node,
        unrefined: false,
        by: human ? 'human' : 'ai',
        kind: c.kind,
        subkind: c.subkind ?? null,
        rule: c.rule,
        paths: c.paths.map(normalizePath),
        terms: c.terms,
        why: c.why,
        not_in_code: c.not_in_code,
        incentive: c.incentive,
        decision,
        sameDecisionAs,
        similarTo: null,
        inCode: human || c.supersedes ? null : inCodeReason(c),
        supersedes: target ? refView(target) : null,
        unknownSupersedes: c.supersedes && !target ? c.supersedes : null,
        feedback: [],
        overlaps: [],
      })
    })
  }
  // 다른 task가 올린 비슷한 후보(similarCandidates)가 있으면 그 후보를 가리키고 채택 안 함이 기본이다 (D326). 앞 후보는
  // 사람 결정에서 다듬은 후보를 먼저, 그다음 올린 차례로 고른다. 사람 결정에서 다듬은 후보, 같은 결정의 뒤 후보(D324),
  // 기존 항목을 고치는 후보(supersedes)는 비슷한 후보로 두지 않는다(사람이 정한 것과 고침이 기본으로 남게). 같은 task의
  // 후보끼리는 묶지 않는다
  const roots: KnowledgeCandidateView[] = []
  const order = [
    ...candidates.filter((c) => c.by === 'human'),
    ...candidates.filter((c) => c.by !== 'human'),
  ]
  for (const c of order) {
    if (c.sameDecisionAs) continue
    const fixed = c.by === 'human' || c.supersedes !== null || c.unknownSupersedes !== null
    const prev = fixed
      ? undefined
      : // 코드로 알 수 있다고 본 후보(K22)는 앞 후보가 되지 않는다: 뒤의 쓸모 있는 후보까지 채택 안 함이 되지 않게
        roots.find((p) => p.taskId !== c.taskId && !p.inCode && similarCandidates(p, c))
    if (prev) c.similarTo = prev.key
    else roots.push(c)
  }
  // 어느 후보와도 묶이지 않은 사람 결정. 같은 결정을 여러 task가 적었으면 처음 것 하나만 보인다 (D304)
  const shown = new Set<string>()
  for (const t of input.tasks) {
    const header = t.header
    if (!header) continue
    header.decisions.forEach((d, i) => {
      const what = d.what.trim()
      if (d.by !== 'human' || first.has(what) || shown.has(what)) return
      shown.add(what)
      candidates.push({
        key: `${t.taskId}#d${i + 1}`,
        taskId: t.taskId,
        node: t.node,
        unrefined: true,
        by: 'human',
        kind: null,
        subkind: null,
        rule: d.what,
        paths: [],
        terms: [],
        why: d.why,
        not_in_code: '사람이 정함',
        incentive: '',
        decision: d.what,
        sameDecisionAs: null,
        similarTo: null,
        inCode: null,
        supersedes: null,
        unknownSupersedes: null,
        feedback: [],
        overlaps: [],
      })
    })
  }
  for (const t of input.tasks) {
    if (!t.header) continue
    for (const f of handoffV2(t.header, t.version)?.knowledge_feedback ?? []) {
      const prev = feedback.get(f.id)
      if (prev) prev.notes.push(f.note)
      else {
        const target = byId.get(f.id)
        feedback.set(f.id, {
          id: f.id,
          taskId: t.taskId,
          notes: [f.note],
          entry: target ? refView(target) : null,
        })
      }
    }
  }
  // 이 Work에서 틀렸다는 보고를 받은 항목과 같은 종류·갈래, 같은 파일, 겹치는 용어인 후보는 그 항목을 고치는 후보로 본다:
  // 대체가 기본이다. 에이전트가 supersedes를 적지 않아도 틀린 항목과 새 규칙이 함께 남지 않게 한다 (지식 탐색 K1)
  for (const c of candidates) {
    if (c.unrefined || c.supersedes || c.unknownSupersedes || c.sameDecisionAs || c.similarTo)
      continue
    const target = input.pool.find(
      (p) =>
        feedback.has(p.entry.id) &&
        p.entry.status === 'active' &&
        !p.carriedPr &&
        similarCandidates(c, p.entry),
    )
    if (target) {
      c.supersedes = refView(target)
      // 틀린 항목을 고치는 후보는 코드로 알 수 있어도 남긴다 (K22)
      c.inCode = null
    }
  }
  for (const c of candidates) {
    c.overlaps = overlappingEntries(c, input.pool)
      .filter((p) => p.entry.id !== c.supersedes?.id)
      .map(refView)
    const f = c.supersedes ? feedback.get(c.supersedes.id) : undefined
    if (f && c.supersedes) {
      c.feedback = f.notes
      feedback.delete(c.supersedes.id)
    }
  }
  const stale = input.pool
    .filter(
      (p) =>
        p.scope === 'team' &&
        p.stale &&
        p.entry.status === 'active' &&
        p.entry.paths.some((x) => input.changed.some((y) => pathsOverlap(x, y))) &&
        !feedback.has(p.entry.id) &&
        !candidates.some((c) => c.supersedes?.id === p.entry.id),
    )
    .map(refView)
  const pending = input.offerPending
    ? input.pool
        .filter((p) => p.scope === 'pending' && !p.carriedPr)
        .filter((p) => !candidates.some((c) => c.supersedes?.id === p.entry.id))
        // 틀렸다는 보고를 받은 공유 대기는 PR에 기본으로 싣지 않는다. 보고 칸에서 [그대로 맞음]을 고르면 실린다 (지식 탐색 K1)
        .filter((p) => !feedback.has(p.entry.id))
        .map(refView)
    : []
  return {
    candidates,
    pending,
    stale,
    feedback: [...feedback.values()],
    share: input.share,
    dir: input.dir,
  }
}

// ---------- 채택 결과 (D287~D289, D302, D308, D310, D320, D322, I73) ----------

/** 거르기를 끝낸 Work의 전달 (I73): [완료만](none), [push], [PR 생성](pr). 머지 뒤 정리 창과 [머지 없이 끝내기]는 none이다 */
export type KnowledgeDelivery = 'none' | 'push' | 'pr'

export interface PlanInput {
  review: KnowledgeReview
  choices: KnowledgeChoices | undefined
  delivery: KnowledgeDelivery
  /** 출처 (D320): 후보마다의 task는 후보에서 읽는다. 사람이 대체·버림한 것은 이 task로 적는다 */
  work: string
  task: string
  /** 기존 항목 (대체할 항목의 원래 내용을 읽는다) */
  pool: readonly PoolEntry[]
  /** [0-9a-z] 8자 */
  random: () => string
}

/**
 * 채택 결과를 계산한다 (I73). 팀 공유가 켜져 있고 [PR 생성]이면 팀 지식은 레포에 쓰고(PR에 실림), 같은 내용을 공유 대기
 * 사본으로도 둔다(D310 (4)). [완료만]·[push]면 팀 지식은 공유 대기다(D287). 팀 공유가 꺼져 있으면 채택은 모두 나만이다
 * (D322). 대체(D302)는 머지된 팀 지식이면 옛 항목을 대체됨으로 고쳐 새 항목과 함께 내보내고, 공유 대기나 나만이면 옛 것을
 * 지우고 새 것을 쓴다(D310 (3)). 해시는 main이 쓰기 바로 전에 채운다(I72)
 */
export function planKnowledge(input: PlanInput): KnowledgePlan {
  const { review, choices } = input
  const share = review.share
  const toRepo = share && input.delivery === 'pr'
  const byId = new Map(input.pool.map((p) => [p.entry.id, p]))
  const plan: KnowledgePlan = {
    repo: [],
    pending: [],
    mine: [],
    removePending: [],
    removeMine: [],
    carry: [],
    counts: { team: 0, mine: 0, pending: 0 },
  }
  const team = (e: KnowledgeEntry) => {
    if (toRepo) {
      plan.repo.push(e)
      plan.carry.push(e.id)
    }
    plan.pending.push(e)
  }
  /** 옛 항목을 대체하거나 버린다. 새 항목이 있으면 superseded_by에 적는다 */
  const retire = (id: string, by: string | null, newTeam: boolean) => {
    const old = byId.get(id)
    if (!old) return
    if (old.scope === 'pending') {
      if (!plan.removePending.includes(id)) plan.removePending.push(id)
      return
    }
    if (old.scope === 'mine') {
      if (!plan.removeMine.includes(id)) plan.removeMine.push(id)
      return
    }
    if (old.scope !== 'team') return
    const superseded: KnowledgeEntry = { ...old.entry, status: 'superseded', superseded_by: by }
    // 머지된 팀 지식의 대체는 팀으로 내보낸다. 팀 공유가 꺼졌거나 새 항목이 나만이면 이 사람에게만 가린다(나만 사본)
    if (share && (newTeam || by === null)) team(superseded)
    else plan.mine.push(superseded)
  }

  for (const c of review.candidates) {
    const ch = candidateChoice(c, choices, share)
    if (!ch.adopt) continue
    const e = editedCandidate(c, ch.edit)
    if (candidateProblem(e) || !e.kind) continue
    const id = newEntryId(e.kind, input.random)
    const source: KnowledgeSource = { work: input.work, task: c.taskId, by: c.by }
    const entry: KnowledgeEntry = {
      id,
      kind: e.kind,
      subkind: e.subkind,
      status: 'active',
      superseded_by: null,
      paths: e.paths,
      terms: e.terms,
      hashes: {},
      source,
      rule: e.rule,
      why: e.why,
      not_in_code: c.not_in_code,
      incentive: c.incentive,
    }
    const isTeam = ch.share === 'team'
    if (isTeam) {
      team(entry)
      plan.counts.team++
    } else {
      plan.mine.push(entry)
      plan.counts.mine++
    }
    const target = ch.replace ? byId.get(ch.replace) : undefined
    // 열린 PR에 실린 항목은 그 PR이 고친다 (D310 (3))
    if (target && !target.carriedPr) retire(target.entry.id, id, isTeam)
  }

  // 후보가 대체하기로 한 항목은 지울 목록에 있다. 아래에서 다시 싣거나 옮기지 않는다
  const retired = (id: string) => plan.removePending.includes(id) || plan.removeMine.includes(id)

  for (const p of review.pending) {
    if (retired(p.id)) continue
    const action = pendingAction(p.id, choices)
    const entry = byId.get(p.id)?.entry
    if (!entry) continue
    if (action === 'share' && share) {
      if (toRepo) {
        plan.repo.push(entry)
        plan.carry.push(entry.id)
        plan.pending.push(entry)
      }
    } else if (action === 'mine') {
      plan.removePending.push(p.id)
      plan.mine.push(entry)
      plan.counts.mine++
    } else if (action === 'drop') {
      plan.removePending.push(p.id)
    }
  }

  const human: KnowledgeSource = { work: input.work, task: input.task, by: 'human' }
  const entryAction = (group: 'stale' | 'feedback', ref: KnowledgeRefView | null) => {
    if (!ref) return
    const ch = entryChoice(group, ref.id, choices)
    const old = byId.get(ref.id)
    if (!old || ch.action === 'leave' || old.carriedPr || retired(ref.id)) return
    if (ch.action === 'confirm') {
      // [그대로 맞음]: 해시를 새로 적어 팀 지식처럼 내보낸다 (D320 (4)). 공유 대기·나만은 그 자리에서 다시 쓴다
      if (old.scope === 'team' || old.scope === 'pending') {
        if (share) team(old.entry)
        else plan.mine.push(old.entry)
      } else if (old.scope === 'mine') plan.mine.push(old.entry)
      return
    }
    if (ch.action === 'drop') {
      retire(ref.id, null, old.scope === 'team')
      return
    }
    const rule = ch.rule?.trim()
    if (!rule) return
    const id = newEntryId(old.entry.kind, input.random)
    const entry: KnowledgeEntry = {
      ...old.entry,
      id,
      status: 'active',
      superseded_by: null,
      hashes: {},
      rule,
      source: human,
    }
    const isTeam = share && old.scope !== 'mine'
    if (isTeam) {
      team(entry)
      plan.counts.team++
    } else {
      plan.mine.push(entry)
      plan.counts.mine++
    }
    retire(ref.id, id, isTeam)
  }
  for (const s of review.stale) entryAction('stale', s)
  for (const f of review.feedback) entryAction('feedback', f.entry)

  plan.counts.pending = toRepo ? 0 : plan.pending.length
  if (!toRepo) plan.carry = []
  dedupe(plan)
  return plan
}

/** 같은 id를 두 번 쓰지 않는다: 뒤의 것(대체됨 처리 등)이 이긴다 */
function dedupe(plan: KnowledgePlan): void {
  const last = (xs: KnowledgeEntry[]) => {
    const m = new Map<string, KnowledgeEntry>()
    for (const e of xs) m.set(e.id, e)
    return [...m.values()]
  }
  plan.repo = last(plan.repo)
  plan.pending = last(plan.pending)
  plan.mine = last(plan.mine)
  plan.carry = [...new Set(plan.carry)]
  plan.removePending = [...new Set(plan.removePending)].filter(
    (id) => !plan.pending.some((e) => e.id === id),
  )
  plan.removeMine = [...new Set(plan.removeMine)].filter(
    (id) => !plan.mine.some((e) => e.id === id),
  )
}

/** 계획에 쓸 것이 있는가 */
export function planEmpty(plan: KnowledgePlan): boolean {
  return (
    plan.repo.length === 0 &&
    plan.pending.length === 0 &&
    plan.mine.length === 0 &&
    plan.removePending.length === 0 &&
    plan.removeMine.length === 0
  )
}

/** 채택 결과의 수 (I73): 전달 결과와 승인 기록에 남긴다 */
export function planCounts(plan: KnowledgePlan): { team: number; mine: number; pending: number } {
  return plan.counts
}

/** 지식 커밋의 메시지 (I73) */
export function knowledgeCommitMessage(workId: string, n: number): string {
  return `relay(${workId}): 지식 ${n}건`
}

/** 해시 갱신 커밋의 메시지 (D323, I73) */
export function hashCommitMessage(workId: string, n: number): string {
  return `relay(${workId}): 지식 해시 ${n}건`
}

/** 커밋 메시지가 이 Work의 지식 커밋인가 (I73): 끊긴 전달의 [다시 시도]가 다시 커밋하지 않는다 */
export function isKnowledgeCommit(workId: string, subject: string): boolean {
  return new RegExp(
    `^relay\\(${workId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\): 지식 \\d+건$`,
  ).test(subject.trim())
}

/**
 * PR에 실린 항목의 해시를 그 head로 다시 적는다 (D323). 바뀐 항목만 돌려준다. 대체됨 항목은 다시 적지 않는다
 */
export function refreshHashes(
  entries: readonly KnowledgeEntry[],
  current: CurrentHashes,
): KnowledgeEntry[] {
  const out: KnowledgeEntry[] = []
  for (const e of entries) {
    if (e.status !== 'active') continue
    const next = withHashes(e, current)
    const same =
      Object.keys(next.hashes).length === Object.keys(e.hashes).length &&
      Object.entries(next.hashes).every(([k, v]) => e.hashes[k] === v)
    if (!same) out.push(next)
  }
  return out
}

/** 지식 폴더 안의 파일인가 (I79). README는 항목이 아니다 */
export function isEntryFile(dir: string, file: string): boolean {
  const f = normalizePath(file)
  const d = normalizePath(dir)
  if (!within(d, f) || f === d) return false
  const rest = f.slice(d.length + 1)
  return new RegExp(`^(${KIND_ALT})/[^/]+\\.md$`).test(rest)
}

/** 지식 파일 경로의 id (`<dir><kind>/<id>.md`) */
export function entryIdOf(file: string): string {
  return normalizePath(file).split('/').pop()?.replace(/\.md$/, '') ?? ''
}

export type { KnowledgeScope }

// ---------- 렌더러가 보낸 값 (I14) ----------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const KINDS: readonly string[] = [
  'domain',
  'recipe',
  'failure',
  'constraint',
  'decision',
  'structure',
]
const SUBKINDS: readonly string[] = ['compat', 'non_goal', 'term']

const strings = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined

/** 고친 값을 읽는다. 틀린 키는 버린다 */
export function readEdit(v: unknown): CandidateEdit | undefined {
  if (!isObject(v)) return undefined
  const out: CandidateEdit = {}
  if (typeof v['kind'] === 'string' && KINDS.includes(v['kind'])) {
    out.kind = v['kind'] as KnowledgeKind
  }
  if (v['subkind'] === null) out.subkind = null
  else if (typeof v['subkind'] === 'string' && SUBKINDS.includes(v['subkind'])) {
    out.subkind = v['subkind'] as NonNullable<CandidateEdit['subkind']>
  }
  for (const k of ['rule', 'why'] as const) if (typeof v[k] === 'string') out[k] = v[k]
  const paths = strings(v['paths'])
  if (paths) out.paths = paths
  const terms = strings(v['terms'])
  if (terms) out.terms = terms
  return out
}

/** 거르기의 선택을 읽는다 (I75). 렌더러가 보낸 값이라 모양을 확인하고 틀린 항목은 버린다(기본 선택이 됨, D303) */
export function readChoices(v: unknown): KnowledgeChoices | undefined {
  if (!isObject(v)) return undefined
  const out: KnowledgeChoices = {}
  if (isObject(v['candidates'])) {
    out.candidates = {}
    for (const [key, c] of Object.entries(v['candidates'])) {
      if (!isObject(c) || typeof c['adopt'] !== 'boolean') continue
      const edit = readEdit(c['edit'])
      out.candidates[key] = {
        adopt: c['adopt'],
        share: c['share'] === 'mine' ? 'mine' : 'team',
        replace: typeof c['replace'] === 'string' ? c['replace'] : null,
        ...(edit ? { edit } : {}),
      }
    }
  }
  if (isObject(v['pending'])) {
    out.pending = {}
    for (const [id, a] of Object.entries(v['pending'])) {
      if (a === 'share' || a === 'hold' || a === 'mine' || a === 'drop') out.pending[id] = a
    }
  }
  for (const group of ['stale', 'feedback'] as const) {
    const g = v[group]
    if (!isObject(g)) continue
    const m: Record<string, { action: 'leave' | 'confirm' | 'replace' | 'drop'; rule?: string }> =
      {}
    for (const [id, c] of Object.entries(g)) {
      if (!isObject(c)) continue
      const a = c['action']
      if (a !== 'leave' && a !== 'confirm' && a !== 'replace' && a !== 'drop') continue
      m[id] = { action: a, ...(typeof c['rule'] === 'string' ? { rule: c['rule'] } : {}) }
    }
    out[group] = m
  }
  return out
}
