// 지식 관리 (docs/design.md 3.6, K1~). 일하는 동안 알게 된 것 가운데 다음 일에도 쓸 사실을 레포의 `docs/knowledge/`에
// 한 항목 한 파일로 남기고(팀이 PR로 함께 쓴다), 다음 task의 context.md에 넣는다. 레포에 아직 없는(기준 브랜치에 머지되지
// 않은) 앞 Work의 지식도 같은 앱의 다음 Work에 넣는다. 환경 변수 RELAY_KNOWLEDGE=off면 모두 끈다(지식 절도 지시도 없다).
import type { TaskNode } from '../shared/contracts'
import { parseFrontMatter } from './validate'

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

/** 지식 파일인가: `docs/knowledge/` 바로 아래의 .md (README.md는 뺀다) */
export function isKnowledgePath(p: string): boolean {
  const norm = p.replace(/\\/g, '/')
  if (!norm.startsWith(`${KNOWLEDGE_DIR}/`)) return false
  const name = norm.slice(KNOWLEDGE_DIR.length + 1)
  return /^[^/]+\.md$/i.test(name) && name.toLowerCase() !== 'readme.md'
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

export interface KnowledgeInput {
  entries: readonly KnowledgeEntry[]
  /** verify: 앞 task들의 지식 후보 */
  candidates: readonly { taskId: string; node: TaskNode; items: readonly string[] }[]
  work_id: string
  /** 오늘 날짜 (YYYY-MM-DD) */
  date: string
}

function fence(text: string): string {
  const body = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map((m) => m[0].length))
  const f = '`'.repeat(Math.max(3, longest + 1))
  return `${f}markdown\n${body}\n${f}`
}

/** 넣을 항목: 비밀로 보이는 것은 빼고, 상한을 넘는 항목은 제목만 */
export function selectEntries(entries: readonly KnowledgeEntry[]): {
  full: KnowledgeEntry[]
  titles: KnowledgeEntry[]
  secret: KnowledgeEntry[]
} {
  const full: KnowledgeEntry[] = []
  const titles: KnowledgeEntry[] = []
  const secret: KnowledgeEntry[] = []
  let used = 0
  for (const e of entries) {
    if (looksSecret(e.text)) {
      secret.push(e)
      continue
    }
    if (used + e.text.length <= INJECT_LIMIT) {
      full.push(e)
      used += e.text.length
    } else titles.push(e)
  }
  return { full, titles, secret }
}

const where = (e: KnowledgeEntry) =>
  e.pendingFrom ? `${e.path} (Work ${e.pendingFrom}에서 남김. 기준 브랜치에는 아직 없다)` : e.path

/** task에 넣은 지식의 글 (INJECTED_FILE). 항목이 없으면 빈 글 */
export function injectedText(entries: readonly KnowledgeEntry[]): string {
  const { full, titles } = selectEntries(entries)
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
    '- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(언제 무엇을 왜 바꿨나 등), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치.',
    '- 사람이 요청이나 답에서 이번 일을 넘어 통하는 규칙을 말했으면(예: "금액은 늘 원 단위로 내림한다", "외부 API 응답은 캐시하지 않는다"), intent에 이번 Work의 비목표나 제약으로 들어가 있어도 지식으로 남긴다. 다음 일의 사람은 같은 말을 다시 하지 않아도 되어야 한다.',
    '- 규칙과 사실, 그 까닭을 쓴다. 코드의 지금 모양(어느 함수가 무엇을 쓰는지)은 이 Work가 바꿨을 수 있고 기준 브랜치에는 아직 없을 수 있으니 "관련 위치"로만 적고 "이렇게 되어 있다"고 쓰지 않는다.',
    '- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 항목은 만들지 않는다(다음 일이 같은 것을 다시 묻게 만든다).',
    '- 지식 후보 가운데 "(사람)"이 붙은 것은 이번 일에만 해당하지 않는 한 모두 남긴다.',
    '- 사람이 알려 준 규칙은 하나도 빠뜨리지 않는다. 규칙이 여럿이면(예: 계산 규칙과 적용 순서) 항목을 나눈다.',
    '- 한 항목에 파일 하나. 파일 이름은 내용을 나타내는 영어 소문자와 `-` (예: `no-cache-external-api.md`). 같은 내용의 파일이 이미 있으면 새로 만들지 말고 그 파일을 고친다.',
    '- 무엇이 맞고 무엇이 틀린지, 예와 수치를 적는다. 다음 사람이 이 파일만 읽고 따를 수 있어야 한다.',
    '- 위 항목 가운데 "기준 브랜치에는 아직 없다"고 적힌 것은 이 worktree에 파일이 없다. 그 항목을 고쳐야 할 때만 같은 경로에 앞 내용을 모두 살려 고친 파일을 쓰고(머지하면 이 Work의 파일이 남는다), 고칠 것이 없으면 그 파일을 만들지 않는다.',
    '- 남긴 파일은 handoff의 `## 요약` 끝에 "남긴 지식: <경로>"로 적는다. 남길 것이 없으면 "남긴 지식: 없음 (까닭)"으로 적는다. 앱이 이 줄을 확인한다.',
    '',
    '파일 형식:',
    '',
    fence(
      [
        '# <한 줄 제목: 규칙이나 사실>',
        '',
        '- 종류: 규칙 | 사실 | 이력 | 실패 유형',
        '- 적용: <관련 경로나 영역>',
        `- 출처: <사람이 알려 줌 / 조사로 알아냄>, relay Work ${input.work_id}, ${input.date}`,
        '',
        '<본문: 5줄 안팎>',
      ].join('\n'),
    ),
    '',
    '#### 앞 task들의 지식 후보',
    '',
    cands.length ? cands.join('\n') : '없음',
  ].join('\n')
}

/** context.md의 지식 절 (제목, 본문). 지식 관리를 끄면 부르지 않는다 */
export function knowledgeSection(node: TaskNode, input: KnowledgeInput): [string, string] {
  const { full, titles } = selectEntries(input.entries)
  const kind = node === 'intake' ? 'intake' : node === 'verify' ? 'verify' : 'work'
  const items = [
    ...full.map((e) => `#### ${where(e)}\n\n${fence(e.text)}`),
    ...(titles.length
      ? [
          '#### 본문을 넣지 않은 항목 (필요하면 읽는다)',
          '',
          ...titles.map((e) => `- ${where(e)}: ${entryTitle(e)}`),
        ]
      : []),
  ]
  const lines = [
    `레포의 \`${KNOWLEDGE_DIR}/\`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.`,
    '',
    USE_RULES[kind],
    '- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.',
    '- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.',
    '',
    '### 항목',
    '',
    items.length ? items.join('\n\n') : '없음',
    '',
    node === 'verify' ? writeRules(input) : CANDIDATE_RULES,
  ]
  return ['팀 지식', lines.join('\n')]
}
