// 지식 관리 (docs/design.md 3.6, K1~). 일하는 동안 알게 된 것 가운데 다음 일에도 쓸 사실을 레포의 `docs/knowledge/`에
// 한 항목 한 파일로 남기고(팀이 PR로 함께 쓴다), 다음 task의 context.md에 넣는다. 레포에 아직 없는(기준 브랜치에 머지되지
// 않은) 앞 Work의 지식도 같은 앱의 다음 Work에 넣는다. 환경 변수 RELAY_KNOWLEDGE=off면 모두 끈다(지식 절도 지시도 없다).
import type { TaskNode } from '../shared/contracts'
import type { FormatIssue } from '../shared/work'
import { HANDOFF_FILE, parseFrontMatter, sectionText } from './validate'

/** 레포 안의 지식 폴더 */
export const KNOWLEDGE_DIR = 'docs/knowledge'

/** task 디렉터리에 남기는, 그 task에 넣은 지식 (평가의 참고 지표). 산출물이 아니다 */
export const INJECTED_FILE = 'knowledge-injected.md'

/** context.md에 본문을 다 넣는 지식의 글자 상한. 넘는 항목은 경로와 제목만 넣는다 */
export const INJECT_LIMIT = 8_000

/** RELAY_KNOWLEDGE=off면 지식 관리를 끈다 (규약 2.2) */
export function knowledgeEnabled(env: NodeJS.ProcessEnv): boolean {
  return (env['RELAY_KNOWLEDGE'] ?? '').trim().toLowerCase() !== 'off'
}

/** 지식 항목 하나 */
export interface KnowledgeEntry {
  /** 레포 안의 경로 (`docs/knowledge/<이름>.md`) */
  path: string
  text: string
  /** 기준 브랜치에 아직 없는, 이 앱에서 완료한 Work의 지식이면 그 Work id */
  pendingFrom?: string
}

/**
 * 지식 파일인가: `docs/knowledge/<이름>.md` 또는 영역 폴더 한 단계 아래 `docs/knowledge/<영역>/<이름>.md` (README.md는 뺀다).
 * 영역 이름은 영어 소문자, 숫자, `-`다 (D293)
 */
export function isKnowledgePath(p: string): boolean {
  const norm = p.replace(/\\/g, '/')
  if (!norm.startsWith(`${KNOWLEDGE_DIR}/`)) return false
  const rest = norm.slice(KNOWLEDGE_DIR.length + 1)
  const m = /^(?:([a-z0-9][a-z0-9-]*)\/)?([^/]+\.md)$/i.exec(rest)
  if (!m) return false
  if (m[1] !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(m[1])) return false
  return (m[2] ?? '').toLowerCase() !== 'readme.md'
}

/** 항목의 제목: 첫 `# ` 줄. 없으면 파일 이름 */
export function entryTitle(e: Pick<KnowledgeEntry, 'path' | 'text'>): string {
  const m = /^#\s+(.+)$/m.exec(e.text)
  return (m?.[1] ?? e.path.split('/').pop() ?? e.path).trim()
}

/**
 * 레포의 지식과 앞 Work의 머지되지 않은 지식을 합친다. 같은 경로면 머지되지 않은 쪽(더 새것)을 쓰고, 내용이 같으면 레포
 * 쪽으로 본다. 머지되지 않은 Work끼리 같은 경로면 뒤에 온 것(나중에 완료한 Work)을 쓴다
 */
export function mergeEntries(
  repo: readonly KnowledgeEntry[],
  pending: readonly KnowledgeEntry[],
): KnowledgeEntry[] {
  const byPath = new Map<string, KnowledgeEntry>()
  for (const e of repo) byPath.set(e.path, e)
  for (const e of pending) {
    const have = byPath.get(e.path)
    if (have && have.text.trim() === e.text.trim()) continue
    byPath.set(e.path, e)
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
}

/** 비밀로 보이는 글 (규약 2.1-3). 걸리면 그 항목은 넣지 않는다 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bxox[abpors]-[A-Za-z0-9-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*\S{6,}/i,
  /(?:비밀번호|암호|토큰)\s*[:=]\s*\S{4,}/,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i,
]

export function looksSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text))
}

/** 지식 후보: handoff 머리글의 knowledge_candidates. 읽지 못하면 빈 목록 */
export function candidatesOf(handoff: string): string[] {
  const fm = parseFrontMatter(handoff)
  const items = fm.ok ? fm.data['knowledge_candidates'] : undefined
  return Array.isArray(items)
    ? items.filter((i): i is string => typeof i === 'string' && i.trim() !== '')
    : []
}

/** 지식 항목의 종류와 출처 (D293). 머리글의 `kind`, `source` */
export const KNOWLEDGE_KINDS = ['rule', 'fact', 'history', 'pitfall'] as const
export const KNOWLEDGE_SOURCES = ['human', 'investigation'] as const

/** 규칙의 본문 절과, 규칙이 아닌 항목의 본문 절 */
const RULE_SECTION = '규칙'
const BODY_SECTION = '내용'
/** 규칙을 아직 따르지 않는 코드(고칠 곳). 규칙 항목에만 둔다 */
const NOT_YET_SECTION = '아직 규칙을 따르지 않는 곳'
const HISTORY_SECTION = '바뀐 이력'
const KNOWN_SECTIONS = [RULE_SECTION, BODY_SECTION, NOT_YET_SECTION, HISTORY_SECTION]

/** `anchor`: 규칙이 붙은 코드 이름. 식별자나 점으로 이은 식별자 */
const ANCHOR = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/

const issue = (file: string, part: FormatIssue['part'], message: string, field?: string) => ({
  file,
  part,
  message,
  ...(field ? { field } : {}),
})

/** 항목의 `anchor`. 형식에 맞지 않거나 없으면 null */
export function anchorOf(text: string): string | null {
  const fm = parseFrontMatter(text)
  const a = fm.ok ? fm.data['anchor'] : undefined
  return typeof a === 'string' && ANCHOR.test(a.trim()) ? a.trim() : null
}

/**
 * 지식 파일의 형식 (D293): 머리글의 `kind`·`source`(허용 값)·`anchor`(선택), 첫 `# ` 제목, 본문 절(규칙은 `## 규칙`, 나머지는
 * `## 내용`), 알려진 절만, `## 아직 규칙을 따르지 않는 곳`은 규칙에만
 */
export function checkEntryFormat(path: string, text: string): FormatIssue[] {
  const out: FormatIssue[] = []
  const fm = parseFrontMatter(text)
  if (!fm.ok)
    return [
      issue(path, 'header', `${fm.error}. 지식 파일은 \`kind\`, \`source\` 머리글로 시작한다`),
    ]
  const kind = fm.data['kind']
  const source = fm.data['source']
  if (!KNOWLEDGE_KINDS.includes(kind as never))
    out.push(issue(path, 'header', `\`kind\`는 ${KNOWLEDGE_KINDS.join(' | ')} 가운데 하나`, 'kind'))
  if (!KNOWLEDGE_SOURCES.includes(source as never))
    out.push(
      issue(path, 'header', `\`source\`는 ${KNOWLEDGE_SOURCES.join(' | ')} 가운데 하나`, 'source'),
    )
  const anchor = fm.data['anchor']
  if (
    anchor !== undefined &&
    anchor !== null &&
    !(typeof anchor === 'string' && ANCHOR.test(anchor.trim()))
  )
    out.push(
      issue(path, 'header', '`anchor`는 코드 이름(식별자) 하나. 없으면 필드를 뺀다', 'anchor'),
    )
  const body = fm.body
  if (!/^#\s+\S/m.test(body)) out.push(issue(path, 'body', '첫 `# ` 제목 줄 없음'))
  const main = kind === 'rule' ? RULE_SECTION : BODY_SECTION
  const mainText = sectionText(body, main)
  if (!mainText)
    out.push(issue(path, 'body', `\`## ${main}\` 절이 없거나 비었음 (kind: ${String(kind)})`, main))
  for (const h of [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1] ?? '')) {
    if (!KNOWN_SECTIONS.includes(h))
      out.push(
        issue(
          path,
          'body',
          `모르는 절 \`## ${h}\`: ${KNOWN_SECTIONS.map((k) => `\`## ${k}\``).join(', ')}만 쓴다`,
          h,
        ),
      )
    else if (h !== main && (h === RULE_SECTION || h === BODY_SECTION))
      out.push(issue(path, 'body', `kind: ${String(kind)}의 본문 절은 \`## ${main}\`이다`, h))
  }
  if (kind !== 'rule' && sectionText(body, NOT_YET_SECTION) !== null)
    out.push(
      issue(path, 'body', `\`## ${NOT_YET_SECTION}\`은 kind: rule에만 둔다`, NOT_YET_SECTION),
    )
  return out
}

/** verify handoff의 지식 줄 (D294) */
export interface KnowledgeLines {
  /** `새 지식: <경로> — <까닭>` */
  added: Map<string, string>
  /** `고친 지식: <경로> — <무엇이 바뀌었나>` */
  updated: Map<string, string>
  /** `남긴 지식: ...` 줄이 있다 */
  none: boolean
}

const LINE = /^\s*(?:[-*]\s*)?(새 지식|고친 지식)\s*:\s*`?([^\s`]+)`?\s*(?:—|–|-|:)?\s*(.*)$/

export function knowledgeLines(handoff: string): KnowledgeLines {
  const summary = sectionText(parseFrontMatter(handoff).body, '요약') ?? ''
  const added = new Map<string, string>()
  const updated = new Map<string, string>()
  for (const line of summary.split('\n')) {
    const m = LINE.exec(line)
    if (!m) continue
    const path = (m[2] ?? '').replace(/^\.\//, '')
    ;(m[1] === '새 지식' ? added : updated).set(path, (m[3] ?? '').trim())
  }
  return { added, updated, none: /남긴 지식\s*:/.test(summary) }
}

/** 지식 확인의 입력 (D293, D294). 앱이 worktree와 앞 Work 브랜치에서 읽어 넘긴다 */
export interface KnowledgeCheckInput {
  /** verify의 handoff.md */
  handoff: string
  /** 이 Work가 기준 커밋에서 더하거나 고친 지식 파일 (커밋하지 않은 것 포함) */
  changed: readonly { path: string; text: string }[]
  /** 이 Work 전에 이미 있던 지식 경로: 기준 커밋의 것과 머지 전 앞 Work의 것 */
  existing: ReadonlySet<string>
  /** 지금 보이는 지식 전부(경로 → 글): 머지 전 앞 Work의 것 위에 이 worktree의 것 */
  current: ReadonlyMap<string, string>
}

/**
 * verify의 지식 확인 (D293, D294): 바꾼 지식 파일의 형식, handoff `## 요약`의 새·고친 지식 줄, 같은 `anchor`를 가진 항목.
 * 형식 검사의 되돌림(D21)으로 에이전트에게 돌아간다
 */
export function knowledgeIssues(input: KnowledgeCheckInput): FormatIssue[] {
  const out: FormatIssue[] = []
  for (const c of input.changed) out.push(...checkEntryFormat(c.path, c.text))

  const lines = knowledgeLines(input.handoff)
  const changed = new Set(input.changed.map((c) => c.path))
  const fix = (message: string) => out.push(issue(HANDOFF_FILE, 'body', message, '요약'))
  if (changed.size === 0 && lines.added.size === 0 && lines.updated.size === 0 && !lines.none) {
    fix('`## 요약`에 지식 줄 없음: 바꾼 지식이 없으면 "남긴 지식: 없음 (까닭)"을 적는다')
  }
  for (const p of changed) {
    const isOld = input.existing.has(p)
    if (lines.added.has(p) && isOld)
      fix(
        `\`${p}\`는 이미 있던 항목이다. "새 지식"이 아니라 "고친 지식: ${p} — <무엇이 바뀌었나>"로 적는다`,
      )
    else if (lines.updated.has(p) && !isOld)
      fix(
        `\`${p}\`는 새 항목이다. "고친 지식"이 아니라 "새 지식: ${p} — <맞는 기존 항목이 없는 까닭>"으로 적는다`,
      )
    else if (!lines.added.has(p) && !lines.updated.has(p))
      fix(
        isOld
          ? `\`${p}\`를 고쳤는데 줄이 없음: "고친 지식: ${p} — <무엇이 바뀌었나>"`
          : `\`${p}\`를 새로 만들었는데 줄이 없음: "새 지식: ${p} — <맞는 기존 항목이 없는 까닭>"`,
      )
    else if (!(lines.added.get(p) ?? lines.updated.get(p) ?? '').trim())
      fix(`\`${p}\`의 줄에 까닭이나 바뀐 내용이 비었음`)
  }
  for (const p of [...lines.added.keys(), ...lines.updated.keys()]) {
    if (!changed.has(p))
      fix(`\`${p}\`를 적었지만 이 Work에서 그 지식 파일을 더하거나 고치지 않았다`)
  }

  const byAnchor = new Map<string, string[]>()
  for (const [p, text] of input.current) {
    const a = anchorOf(text)
    if (a) byAnchor.set(a, [...(byAnchor.get(a) ?? []), p])
  }
  for (const [a, paths] of byAnchor) {
    if (paths.length > 1 && paths.some((p) => changed.has(p)))
      out.push(
        issue(
          paths.find((p) => changed.has(p)) ?? HANDOFF_FILE,
          'header',
          `같은 anchor \`${a}\`를 가진 항목이 여럿: ${paths.map((p) => `\`${p}\``).join(', ')}. 한 항목으로 합치고(같은 경로를 고침) 다른 항목은 지우거나 가리키게 한다`,
          'anchor',
        ),
      )
  }
  return out
}

export interface KnowledgeInput {
  entries: readonly KnowledgeEntry[]
  /** verify: 앞 task들의 지식 후보 */
  candidates: readonly { taskId: string; node: TaskNode; items: readonly string[] }[]
  work_id: string
  /** 오늘 날짜 (YYYY-MM-DD) */
  date: string
  /** 지식이 많을 때 관련 항목을 고르는 단서 (D295) */
  query?: KnowledgeQuery
}

function fence(text: string): string {
  const body = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map((m) => m[0].length))
  const f = '`'.repeat(Math.max(3, longest + 1))
  return `${f}markdown\n${body}\n${f}`
}

/** 지식이 많을 때 본문째 넣는 항목 수와 제목만 넣는 항목 수 (D295) */
export const PICK_LIMIT = 15
export const TITLE_LIMIT = 20

/**
 * 관련 지식을 고르는 데 쓰는 이 task의 단서 (D295). 앱이 요청, intent, 이 Work의 diff, (verify는) 바꾼 지식과 후보에서 만든다
 */
export interface KnowledgeQuery {
  /** 낱말을 견줄 글: 요청, intent, 바꾼 지식, 지식 후보 */
  text: string
  /** 이 Work가 바꾼 파일이나 글에 나온 경로 */
  paths: readonly string[]
  /** diff나 글에 나온 코드 이름(상수, 함수) */
  identifiers: ReadonlySet<string>
}

const HANGUL = /[가-힣]/

/** 낱말: 한글은 붙은 글자 둘씩(조사가 붙어도 겹치게), 나머지는 소문자 낱말(3자 이상) */
export function termsOf(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []) {
    if (HANGUL.test(w)) {
      const chars = [...w].filter((c) => HANGUL.test(c))
      for (let k = 0; k + 1 < chars.length; k++) out.add(`${chars[k]}${chars[k + 1]}`)
    } else if (w.length >= 3) out.add(w)
  }
  return out
}

/** 글에 나온 파일 경로 (`a/b.c` 꼴) */
export function pathsIn(text: string): string[] {
  return [...new Set(text.match(/[\w.-]+(?:\/[\w.-]+)+\.[A-Za-z0-9]+/g) ?? [])]
}

/** 글에 나온 코드 이름: 영문자로 시작하는 4자 이상 식별자 */
export function identifiersIn(text: string): Set<string> {
  return new Set(text.match(/\b[A-Za-z_$][\w$]{3,}\b/g) ?? [])
}

/** 항목의 영역: `docs/knowledge/<영역>/` 폴더. 없으면 null */
function areaOf(p: string): string | null {
  const m = /^docs\/knowledge\/([^/]+)\/[^/]+$/.exec(p)
  return m?.[1] ?? null
}

/** 규칙이나 내용 절, 없으면 글 전체 (옛 형식) */
function coreText(e: KnowledgeEntry): string {
  const body = parseFrontMatter(e.text).body
  return [entryTitle(e), sectionText(body, '규칙') ?? sectionText(body, '내용') ?? body].join('\n')
}

/**
 * 관련 점수 (D295): 같은 anchor 5, 경로 겹침 4(같은 파일)·2(같은 폴더), 영역 2, 낱말 3(질의와 겹친 낱말의 무게 / 항목 낱말의
 * 무게, 드문 낱말일수록 무겁다), 머지 전 항목 0.5. 높은 차례로 돌려준다. 점수가 같으면 경로 차례
 */
export function rankEntries(
  entries: readonly KnowledgeEntry[],
  q: KnowledgeQuery,
): { entry: KnowledgeEntry; score: number }[] {
  const qTerms = termsOf(q.text)
  const docTerms = entries.map((e) => termsOf(coreText(e)))
  const df = new Map<string, number>()
  for (const ts of docTerms) for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1)
  const idf = (t: string) => Math.log(1 + entries.length / (df.get(t) ?? 1))
  const qPaths = q.paths.map((p) => p.replace(/^\.\//, ''))
  const qDirs = new Set(qPaths.map((p) => p.split('/').slice(0, -1).join('/')).filter(Boolean))
  const qSegments = new Set(qPaths.flatMap((p) => p.toLowerCase().split('/')))
  const lastOf = (id: string) => id.split('.').pop() ?? id
  return entries
    .map((entry, k) => {
      let score = 0
      const anchor = anchorOf(entry.text)
      if (anchor && (q.identifiers.has(anchor) || q.identifiers.has(lastOf(anchor)))) score += 5
      const ePaths = pathsIn(entry.text)
      if (ePaths.some((p) => qPaths.includes(p))) score += 4
      else if (ePaths.some((p) => qDirs.has(p.split('/').slice(0, -1).join('/')))) score += 2
      const area = areaOf(entry.path)
      if (area && (qSegments.has(area) || qTerms.has(area))) score += 2
      const ts = docTerms[k] ?? new Set<string>()
      let all = 0
      let hit = 0
      for (const t of ts) {
        const w = idf(t)
        all += w
        if (qTerms.has(t)) hit += w
      }
      if (all > 0) score += (3 * hit) / all
      if (entry.pendingFrom) score += 0.5
      return { entry, score }
    })
    .sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path))
}

/** 넣을 항목 (D286, D295) */
export interface Selection {
  full: KnowledgeEntry[]
  titles: KnowledgeEntry[]
  secret: KnowledgeEntry[]
  /** 지식이 많아 관련 항목만 골랐다 */
  narrowed: boolean
  /** 넣지 않은 항목 수 (본문도 제목도) */
  rest: number
  total: number
}

/**
 * 넣을 항목 (D286, D295): 비밀로 보이는 것은 뺀다. 남은 지식이 모두 상한(INJECT_LIMIT) 안이면 전부 본문째 넣는다. 넘으면
 * 단서(query)로 관련 점수를 매겨 높은 차례로 PICK_LIMIT개까지 상한 안에서 본문째, 그다음 TITLE_LIMIT개는 제목만 넣는다.
 * 단서가 없으면 경로 차례로 상한까지 본문, 나머지는 제목이다
 */
export function selectEntries(
  entries: readonly KnowledgeEntry[],
  query?: KnowledgeQuery,
): Selection {
  const secret = entries.filter((e) => looksSecret(e.text))
  const ok = entries.filter((e) => !looksSecret(e.text))
  const total = ok.length
  const size = ok.reduce((n, e) => n + e.text.length, 0)
  if (size <= INJECT_LIMIT) return { full: ok, titles: [], secret, narrowed: false, rest: 0, total }
  if (!query) {
    const full: KnowledgeEntry[] = []
    const titles: KnowledgeEntry[] = []
    let used = 0
    for (const e of ok) {
      if (used + e.text.length <= INJECT_LIMIT) {
        full.push(e)
        used += e.text.length
      } else titles.push(e)
    }
    return { full, titles, secret, narrowed: false, rest: 0, total }
  }
  const ranked = rankEntries(ok, query)
  const full: KnowledgeEntry[] = []
  const titles: KnowledgeEntry[] = []
  let used = 0
  for (const { entry, score } of ranked) {
    if (score > 0 && full.length < PICK_LIMIT && used + entry.text.length <= INJECT_LIMIT) {
      full.push(entry)
      used += entry.text.length
    } else if (titles.length < TITLE_LIMIT) titles.push(entry)
  }
  return { full, titles, secret, narrowed: true, rest: total - full.length - titles.length, total }
}

const where = (e: KnowledgeEntry) =>
  e.pendingFrom ? `${e.path} (Work ${e.pendingFrom}에서 남김. 기준 브랜치에는 아직 없다)` : e.path

/** task에 넣은 지식의 글 (INJECTED_FILE). 항목이 없으면 빈 글 */
export function injectedText(entries: readonly KnowledgeEntry[], query?: KnowledgeQuery): string {
  const { full, titles } = selectEntries(entries, query)
  return [
    ...full.map((e) => `## ${where(e)}\n\n${e.text.trim()}\n`),
    ...titles.map((e) => `## ${where(e)}\n\n(제목만) ${entryTitle(e)}\n`),
  ].join('\n')
}

const USE_RULES: Record<'intake' | 'work' | 'verify', string> = {
  intake:
    '- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례(종류가 규칙)는 intent에 따르고 `제약`에 "(팀 지식 `<경로>`) <내용>"으로 옮겨 사람이 의도 승인에서 보게 한다. 조사로 알아낸 사실과 실패 유형은 이번 버그의 원인이라는 근거가 아니므로 intent에 쓰지 않고, handoff의 `## 다음 task가 알아야 할 것`에 참고할 항목의 경로만 적는다.',
  work: '- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.',
  verify:
    '- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 리뷰할 때 변경이 그 항목을 어기는지도 본다.',
}

const CANDIDATE_RULES = [
  '### 지식 후보 남기기',
  '',
  'handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.',
  '',
  '- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.',
  '- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.',
  '- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.',
  '- 사람의 지금 말이 위 항목과 어긋나면(값이나 규칙이 바뀌었으면) "고칠 지식: <경로> — <새 내용> (사람)"으로 후보에 적는다. verify가 그 항목을 고친다.',
].join('\n')

function writeRules(input: KnowledgeInput): string {
  const cands = input.candidates.flatMap((c) =>
    c.items.map((i) => `- ${c.taskId} ${c.node}: ${i.replace(/\s*\n\s*/g, ' ')}`),
  )
  return [
    '### 지식 남기기 (이 단계에서 할 일)',
    '',
    `공통 종료 절차의 커밋 전에, 이 Work에서 알게 된 것 가운데 다음 일에도 쓸 사실을 레포의 \`${KNOWLEDGE_DIR}/\`에 남기고 코드와 함께 커밋한다. 팀이 PR로 함께 보고, 다음 일의 에이전트가 읽는다. 재료는 아래 지식 후보, Work 요청 원문(\`request.md\`), intent의 \`비목표\`와 \`제약\`, 결정 로그의 사람 결정(\`by: human\`), 이 task에서 사람이 한 말이다.`,
    '',
    '무엇을 남기나:',
    '',
    '- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(언제 무엇을 왜 바꿨나 등), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치.',
    '- 사람이 요청이나 답에서 이번 일을 넘어 통하는 규칙을 말했으면(예: "금액은 늘 원 단위로 내림한다", "외부 API 응답은 캐시하지 않는다"), intent에 이번 Work의 비목표나 제약으로 들어가 있어도 지식으로 남긴다. 다음 일의 사람은 같은 말을 다시 하지 않아도 되어야 한다.',
    '- 지식 후보 가운데 "(사람)"이 붙은 것은 이번 일에만 해당하지 않는 한 모두 남긴다. 사람이 알려 준 규칙은 하나도 빠뜨리지 않는다.',
    '- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 항목은 만들지 않는다.',
    '',
    '기존 항목을 고칠지 새로 만들지 (먼저 위 "항목"을 본다):',
    '',
    '- 남길 것마다 위 항목 가운데 같은 대상(같은 규칙, 같은 값, 같은 코드 이름)을 다루는 것이 있는지 먼저 찾는다. 있으면 그 파일을 **같은 경로에서** 고친다. 이름이 달라도 대상이 같으면 같은 항목이다. 맞는 것이 없을 때만 새 파일을 만든다.',
    '- 사람의 지금 말이 기존 항목과 어긋나면(값이나 규칙이 바뀌었으면) 그 항목을 반드시 고친다. 새 파일을 따로 만들어 옛 항목을 그대로 두지 않는다. `## 바뀐 이력`에 "<날짜> <옛 값> → <새 값> (Work <id>, 사람이 알려 줌)"을 한 줄 더한다.',
    '- "기준 브랜치에는 아직 없다"고 적힌 항목은 이 worktree에 파일이 없다. 고칠 때는 위에 보인 앞 내용을 모두 살려 같은 경로에 새 형식으로 쓴다(머지하면 이 Work의 파일이 남는다). 고칠 것이 없으면 그 파일을 만들지 않는다.',
    '- 한 사실은 한 곳에만 쓴다. 값이나 규칙은 그것을 다루는 항목 한 곳에만 적고, 다른 항목에서는 "<경로> 참고"로 가리킨다. 다른 항목에 곁들여 적은 값은 바뀔 때 함께 고쳐지지 않는다.',
    '',
    '파일 형식 (앱이 확인한다. 틀리면 되돌아온다):',
    '',
    '- 경로는 `docs/knowledge/<영역>/<이름>.md` 또는 `docs/knowledge/<이름>.md`. 영역과 이름은 영어 소문자, 숫자, `-` (예: `shipping/free-shipping-threshold.md`).',
    '- `kind: rule`(이래야 한다)이면 본문 절은 `## 규칙`, 그 밖(`fact`, `history`, `pitfall`)은 `## 내용`이다.',
    '- `## 규칙`에는 이래야 하는 것만 쓴다. 지금 코드가 규칙을 따르지 않는 곳(고칠 곳)은 `## 아직 규칙을 따르지 않는 곳`에 쓴다. "지금 코드는 ~를 쓴다"를 규칙처럼 쓰면 다음 사람이 그것을 규칙으로 읽는다.',
    '- 규칙이 코드 이름(상수, 함수)에 붙어 있으면 머리글의 `anchor`에 그 이름을 적는다. 같은 `anchor`를 가진 항목이 둘이면 앱이 되돌린다.',
    '',
    fence(
      [
        '---',
        'kind: rule            # rule | fact | history | pitfall',
        'source: human         # human (사람이 알려 줌) | investigation (조사로 알아냄)',
        'anchor: SOME_CONSTANT # 규칙이 붙은 코드 이름. 없으면 이 줄을 뺀다',
        '---',
        '# <한 줄 제목: 규칙이나 사실>',
        '',
        '## 규칙',
        '- <이래야 하는 것. 예와 수치>',
        '',
        '## 아직 규칙을 따르지 않는 곳',
        '- <경로>: <지금 어떻게 되어 있어 고쳐야 하나> (없으면 이 절을 뺀다)',
        '',
        '## 바뀐 이력',
        `- ${input.date} 처음 남김 (Work ${input.work_id})`,
      ].join('\n'),
    ),
    '',
    'handoff에 적는 줄 (앱이 확인한다):',
    '',
    '- `## 요약` 끝에 바꾼 지식 파일마다 한 줄: 새로 만든 파일은 `새 지식: <경로> — <맞는 기존 항목이 없는 까닭>`, 이미 있던 파일(위 항목에 보인 것)을 고쳤으면 `고친 지식: <경로> — <무엇이 바뀌었나>`.',
    '- 바꾼 지식이 없으면 `남긴 지식: 없음 (까닭)`.',
    '',
    '#### 앞 task들의 지식 후보',
    '',
    cands.length ? cands.join('\n') : '없음',
  ].join('\n')
}

/**
 * 머지되지 않은 앞 Work의 지식이 있을 때 (D292): 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가
 * 요청 밖에서 보여도 범위를 넓히지 않는다
 */
const PENDING_RULE =
  '- "기준 브랜치에는 아직 없다"고 적힌 항목은 머지를 기다리는 앞 Work에서 왔다. 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보이면 앞 Work가 이미 고친 곳일 수 있으니, 범위를 넓히지 말고 handoff의 `risks`에 "앞 Work(<id>)에서 고쳤을 수 있음, 머지 대기"로 적는다.'

/** context.md의 지식 절 (제목, 본문). 지식 관리를 끄면 부르지 않는다 */
export function knowledgeSection(node: TaskNode, input: KnowledgeInput): [string, string] {
  const { full, titles, narrowed, rest, total } = selectEntries(input.entries, input.query)
  const kind = node === 'intake' ? 'intake' : node === 'verify' ? 'verify' : 'work'
  const items = [
    ...full.map((e) => `#### ${where(e)}\n\n${fence(e.text)}`),
    ...(titles.length
      ? [
          narrowed
            ? '#### 관련이 낮아 제목만 넣은 항목 (필요하면 읽는다)'
            : '#### 본문을 넣지 않은 항목 (필요하면 읽는다)',
          '',
          ...titles.map((e) => `- ${where(e)}: ${entryTitle(e)}`),
        ]
      : []),
  ]
  const lines = [
    `레포의 \`${KNOWLEDGE_DIR}/\`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.`,
    '',
    USE_RULES[kind],
    ...(input.entries.some((e) => e.pendingFrom) ? [PENDING_RULE] : []),
    '- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.',
    '- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.',
    '- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.',
    '',
    '### 항목',
    '',
    ...(narrowed
      ? [
          `지식이 많아 이 일과 관련 있어 보이는 항목만 넣었다(전체 ${total}개 가운데 본문 ${full.length}개, 제목 ${titles.length}개${rest ? `, 넣지 않음 ${rest}개` : ''}). 남길 것과 같은 대상을 다루는 항목이 보이지 않으면 \`${KNOWLEDGE_DIR}/\`를 낱말이나 코드 이름으로 찾아본 뒤 새로 만든다.`,
          '',
        ]
      : []),
    items.length ? items.join('\n\n') : '없음',
    '',
    node === 'verify' ? writeRules(input) : CANDIDATE_RULES,
  ]
  return ['팀 지식', lines.join('\n')]
}
