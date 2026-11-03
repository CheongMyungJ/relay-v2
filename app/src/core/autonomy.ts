// 자율 진행의 계획 보기 (docs/design.md D542, D560). 세션이 하는 Work(D557)의 세션은 plan.md를 쓸 수도 있고 안 쓸 수도 있다.
// 앱은 형식을 검사하지 않고(D533~D541의 관문은 D557로 없앰), 있으면 읽을 수 있는 만큼 화면의 계획으로 보인다
/** 자율 진행의 계획 파일 (D534). 있으면 보인다 */
export const PLAN_FILE = 'plan.md'

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

/** `## 전략`의 `- 방식:` 줄을 +로 나눠 읽는다. 이름은 정해져 있지 않다. 줄이 없으면 빈 목록 */
export function readStrategy(plan: string): string[] {
  const line = (section(plan, '전략') ?? '').split('\n').find((l) => /^\s*-\s*방식\s*:/.test(l))
  if (!line) return []
  return line
    .replace(/^\s*-\s*방식\s*:/, '')
    .split('+')
    .map((x) => x.replace(/`/g, '').trim())
    .filter(Boolean)
}

// ---------- 지켜보기 (D542) ----------

/** plan.md `## 조각` 표의 한 줄 */
export interface PlanPieceView {
  id: string
  goal: string
  /** 실행 형태: 직접, 서브에이전트, 자식 Work 등 세션이 쓴 그대로 */
  how: string
  /** 결과 칸. 비었으면 아직이다 */
  result: string
  done: boolean
}

/** 진행 중인 자율 진행의 계획 (D542). 화면이 plan.md를 다시 읽을 때마다 만든다 */
export interface PlanView {
  /** 읽은 방식. 줄이 없으면 빈 목록 */
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
 * 형식이 틀려도 읽을 수 있는 만큼 돌려준다
 */
export function planView(plan: string): PlanView {
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
  return { strategies: readStrategy(plan), pieces, changes }
}
