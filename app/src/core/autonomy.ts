// 자율 진행의 관문 (docs/design.md 5.6.16, D533~D541). 자율 Work(auto)의 orchestrate는 진행 방식을 스스로 고르므로, 앱은 과정이
// 아니라 결과를 본다: plan.md의 방식 줄과 실제 커밋이 맞는지, 동작을 바꿨으면 시험이 있는지. git은 부르지 않고 main이 읽어 넘긴
// 커밋과 파일로 판정한다 (I9)
import type { FormatIssue } from '../shared/work'
import { BUILTIN_TYPES } from '../shared/builtin-types'
import { isTestPath } from './test-path'

/** 자율 진행의 산출물 (D534) */
export const PLAN_FILE = 'plan.md'

/** plan.md의 필수 절 (D534). 유형 정의(skills/types/auto/type.json)의 단계 절과 같다 */
export const PLAN_SECTIONS: readonly string[] = BUILTIN_TYPES.auto.steps[0]?.sections ?? []

/** plan.md `## 전략`의 방식 이름 (D535). 첫 줄 `- 방식: <이름> + <이름>`에 쓴다 */
export const STRATEGIES = [
  '바로 고침',
  '재현 시험 먼저',
  '안전망 먼저',
  'TDD',
  '설계 먼저',
  '스파이크 먼저',
] as const

export type Strategy = (typeof STRATEGIES)[number]

/** 시험 커밋이 다른 코드 커밋보다 앞서야 하는 방식 (D536) */
export const TEST_FIRST: readonly Strategy[] = ['재현 시험 먼저', '안전망 먼저', 'TDD']

/** 동작을 바꾸고 시험을 더하지 못했을 때 `## 변경 요약`에 쓰는 줄의 표시 (D537) */
export const NO_TEST_MARK = '(테스트 못 더함)'

/** 문서로 보는 파일 확장자 (D537, 기본값). 이 파일만 바꾼 커밋은 동작을 바꾸지 않은 것으로 본다 */
const DOC_EXT = /\.(md|mdx|markdown|txt|rst|adoc)$/i

/** 동작을 바꿀 수 있는 파일인가 (D537): 시험 파일도 문서도 아니다 */
export function isBehaviorPath(file: string): boolean {
  return !isTestPath(file) && !DOC_EXT.test(file)
}

/** 기준 커밋 뒤의 커밋 하나와 그 커밋이 바꾼 파일 (오래된 것부터) */
export interface PlanCommit {
  commit: string
  files: readonly string[]
}

/** 관문이 보는 사실 (D536, D537). main이 worktree의 git에서 읽는다 */
export interface AutonomyFacts {
  commits: readonly PlanCommit[]
}

const normalize = (s: string) => s.replace(/\r\n?/g, '\n')

/** `## <name>` 절의 본문. 없으면 null */
function section(text: string, name: string): string | null {
  const lines = normalize(text).split('\n')
  const start = lines.findIndex((l) => l.trim() === `## ${name}`)
  if (start < 0) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^##? /.test(l))
  return (end < 0 ? rest : rest.slice(0, end)).join('\n')
}

/** 방식 줄을 읽은 결과: 이름들, 또는 모르는 이름이나 줄이 없음 (D535) */
export type StrategyRead =
  | { ok: true; strategies: Strategy[] }
  | { ok: false; reason: 'missing' | 'unknown'; unknown?: string[] }

/** plan.md `## 전략`의 `- 방식:` 줄을 읽는다 (D535) */
export function readStrategy(plan: string): StrategyRead {
  const body = section(plan, '전략')
  const line = body?.split('\n').find((l) => /^\s*-\s*방식\s*:/.test(l))
  if (!line) return { ok: false, reason: 'missing' }
  const names = line
    .replace(/^\s*-\s*방식\s*:/, '')
    .split('+')
    // 이름 뒤의 괄호 설명(예: `TDD(자식 안에서)`)은 뗀다
    .map((n) =>
      n
        .trim()
        .replace(/\s*[(（][^)）]*[)）]\s*$/, '')
        .replace(/^`|`$/g, '')
        .trim(),
    )
    .filter(Boolean)
  if (names.length === 0) return { ok: false, reason: 'missing' }
  const unknown = names.filter((n) => !(STRATEGIES as readonly string[]).includes(n))
  if (unknown.length) return { ok: false, reason: 'unknown', unknown }
  return { ok: true, strategies: names as Strategy[] }
}

const issue = (field: string, message: string): FormatIssue => ({
  file: PLAN_FILE,
  part: 'body',
  field,
  message,
})

/**
 * plan.md 자체의 관문 (D535): 방식 줄이 있고 이름을 표에서 골랐는지, 설계 먼저면 `## 설계`가 있는지. 파일이 있으면 늘 본다
 */
export function planIssues(plan: string): FormatIssue[] {
  const read = readStrategy(plan)
  if (!read.ok) {
    return [
      issue(
        '전략',
        read.reason === 'missing'
          ? `\`## 전략\`의 첫 줄에 \`- 방식: <이름>\` 없음: 이름은 ${STRATEGIES.join(', ')} 가운데서 (+로 여럿)`
          : `\`- 방식:\`에 모르는 이름 ${(read.unknown ?? []).join(', ')}: ${STRATEGIES.join(', ')} 가운데서 (+로 여럿)`,
      ),
    ]
  }
  if (read.strategies.includes('설계 먼저') && section(plan, '설계') === null) {
    return [issue('설계', '`## 설계` 절 없음: `- 방식:`에 설계 먼저가 있으면 필수 (D535)')]
  }
  return []
}

/**
 * 커밋으로 보는 관문 (D536, D537). 마무리 단계가 리뷰를 요청하거나 마무리할 때 본다.
 * - 동작을 바꾼 파일이 있는데 시험 파일을 하나도 바꾸지 않았으면 `## 변경 요약`에 `(테스트 못 더함)` 줄이 있어야 한다
 * - 방식이 시험을 먼저 쓰는 것이면, 시험 파일만 바꾼 커밋이 동작을 바꾼 첫 커밋보다 앞서야 한다
 * 에이전트의 말이 아니라 커밋을 본다
 */
export function commitIssues(plan: string, facts: AutonomyFacts): FormatIssue[] {
  const issues: FormatIssue[] = []
  const files = facts.commits.flatMap((c) => c.files)
  const behavior = files.some(isBehaviorPath)
  const tested = files.some(isTestPath)
  if (behavior && !tested) {
    const summary = section(plan, '변경 요약') ?? ''
    if (!summary.split('\n').some((l) => l.includes(NO_TEST_MARK))) {
      issues.push(
        issue(
          '변경 요약',
          `동작을 바꾼 파일이 커밋에 있는데 바꾼 시험 파일이 없음: 시험을 더해 커밋하거나, \`## 변경 요약\`에 \`- ${NO_TEST_MARK} 바꾼 동작 — 이유\` 줄을 쓰세요 (D537)`,
        ),
      )
    }
  }
  const read = readStrategy(plan)
  const claimed = read.ok ? read.strategies.filter((s) => TEST_FIRST.includes(s)) : []
  if (claimed.length && behavior) {
    const firstBehavior = facts.commits.findIndex((c) => c.files.some(isBehaviorPath))
    const testOnly = facts.commits.findIndex(
      (c) =>
        c.files.length > 0 && c.files.every((f) => !isBehaviorPath(f)) && c.files.some(isTestPath),
    )
    if (testOnly < 0 || testOnly > firstBehavior) {
      issues.push(
        issue(
          '전략',
          `\`- 방식:\`이 ${claimed.join(', ')}인데 시험 파일만 바꾼 커밋이 동작을 바꾼 첫 커밋보다 앞서지 않음: 실제로 일한 방식으로 \`- 방식:\`을 고치고 \`## 바뀐 계획\`에 까닭을 쓰세요 (D536)`,
        ),
      )
    }
  }
  return issues
}

// ---------- 지켜보기 (D542) ----------

/** plan.md `## 조각` 표의 한 줄 */
export interface PlanPieceView {
  id: string
  goal: string
  /** 실행 형태: 직접, 서브에이전트 (D539) */
  how: string
  /** 결과 칸. 비었으면 아직이다 */
  result: string
  done: boolean
}

/** 진행 중인 자율 진행의 계획 (D542). 화면이 plan.md를 다시 읽을 때마다 만든다 */
export interface PlanView {
  /** 읽은 방식. 줄이 없거나 모르는 이름이면 빈 목록 */
  strategies: string[]
  pieces: PlanPieceView[]
  /** `## 바뀐 계획`의 줄. "없음"은 뺀다 */
  changes: string[]
}

/** 표의 한 줄을 칸으로 나눈다. 구분 줄(|---|)이나 표가 아니면 null */
function cells(line: string): string[] | null {
  const t = line.trim()
  if (!t.startsWith('|') || /^\|[\s:|-]+\|?$/.test(t)) return null
  return t
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())
}

/** 결과 칸이 끝났다는 뜻인가 (D542): 비었거나 진행 중·아직·대기가 아니면 끝난 것으로 본다 */
function finished(result: string): boolean {
  const r = result.replace(/[`*]/g, '').trim()
  return r !== '' && r !== '-' && r !== '—' && !/^(진행|하는 중|작업 중|아직|대기|예정)/.test(r)
}

/**
 * plan.md를 화면의 계획으로 읽는다 (D542): 방식, 조각 표(머리 줄의 칸 이름으로 id·목표·실행 형태·결과를 찾음), 바뀐 계획.
 * 형식이 틀려도 읽을 수 있는 만큼 돌려준다. 형식 오류는 관문(planIssues)이 따로 알린다
 */
export function planView(plan: string): PlanView {
  const read = readStrategy(plan)
  const table = (section(plan, '조각') ?? '').split('\n').map(cells)
  const rows = table.filter((r): r is string[] => r !== null)
  const head = rows[0] ?? []
  const col = (name: string, fallback: number) => {
    const i = head.indexOf(name)
    return i >= 0 ? i : fallback
  }
  const [id, goal, how, result] = [
    col('id', 0),
    col('목표', 1),
    col('실행 형태', 2),
    col('결과', head.length - 1),
  ]
  const pieces = rows.slice(1).map((r) => {
    const res = r[result] ?? ''
    return {
      id: r[id] ?? '',
      goal: r[goal] ?? '',
      how: r[how] ?? '',
      result: res,
      done: finished(res),
    }
  })
  const changes = (section(plan, '바뀐 계획') ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter((l) => l !== '' && !/^\(?없음/.test(l))
  return { strategies: read.ok ? read.strategies : [], pieces, changes }
}
