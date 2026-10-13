// 구현 나눔으로 Work 만들기 (D393~D398, 실험 위임). 설계 문서의 `## 구현 나눔` 표를 읽고, 조각마다 상태를 정하고,
// 새 Work의 요청과 조각 Work의 context.md 절을 만든다. git과 파일은 읽지 않는다(main이 읽어 넘긴다).
import { WORK_TYPE_LABEL, type PlanRef, type WorkStatus, type WorkType } from '../shared/work'
import type { PlanSliceStatus } from '../shared/views'
import { sectionText } from './validate'

/** 설계 문서에서 찾는 절 (D366의 "구현 나눔") */
export const SPLIT_SECTION = '구현 나눔'

export interface PlanSlice {
  /** 표의 `조각` 칸. 문서 안에서 겹치지 않는다 */
  id: string
  name: string
  /** `유형` 칸. 비었거나 알 수 없으면 null(사람이 고른다) */
  type: WorkType | null
  /** `먼저` 칸: 머지된 뒤에야 이 조각을 시작할 수 있는 조각들 */
  after: string[]
  goal: string
}

export interface PlanDoc {
  /** 레포 맨 위에서의 경로 */
  path: string
  slices: PlanSlice[]
  /** 표를 읽으며 찾은 문제. 문제가 있는 문서도 보이되 그 조각은 고를 수 없게 한다 */
  issues: string[]
}

export type { PlanRef }

const ID = /^[A-Za-z0-9][\w.-]*$/
const NONE = new Set(['', '-', '–', '—', '없음'])

function cells(line: string): string[] {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return t.split('|').map((c) => c.trim().replace(/^`(.*)`$/, '$1'))
}

function typeOf(cell: string): WorkType | null {
  const c = cell.trim()
  for (const [type, label] of Object.entries(WORK_TYPE_LABEL) as [WorkType, string][]) {
    if (c === label || c === type) return type
  }
  return null
}

/**
 * 문서의 `## 구현 나눔` 절에서 첫 표를 읽는다. 칸은 제목으로 찾는다: `조각`(필수), `이름`(필수), `유형`, `먼저`, `목표`.
 * 절이나 표가 없으면 null
 */
export function parseSplit(path: string, markdown: string): PlanDoc | null {
  const section = sectionText(markdown, SPLIT_SECTION)
  if (section === null) return null
  const rows = section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
  if (rows.length < 2) return null
  const head = cells(rows[0] ?? '')
  const col = (name: string) => head.findIndex((h) => h === name)
  const at = {
    id: col('조각'),
    name: col('이름'),
    type: col('유형'),
    after: col('먼저'),
    goal: col('목표'),
  }
  if (at.id < 0 || at.name < 0) return null
  const issues: string[] = []
  const slices: PlanSlice[] = []
  for (const row of rows.slice(1)) {
    const c = cells(row)
    if (c.every((x) => /^:?-{2,}:?$/.test(x) || x === '')) continue
    const id = c[at.id] ?? ''
    if (!ID.test(id)) {
      issues.push(`조각 이름이 알맞지 않음: \`${id}\``)
      continue
    }
    if (slices.some((s) => s.id === id)) {
      issues.push(`조각 \`${id}\`가 두 번 나옴`)
      continue
    }
    const typeCell = at.type < 0 ? '' : (c[at.type] ?? '')
    const type = typeOf(typeCell)
    if (typeCell.trim() && !type) issues.push(`조각 \`${id}\`의 유형을 알 수 없음: ${typeCell}`)
    const afterCell = at.after < 0 ? '' : (c[at.after] ?? '')
    const after = NONE.has(afterCell.trim())
      ? []
      : afterCell
          .split(/[,\s]+/)
          .map((x) => x.trim().replace(/^`(.*)`$/, '$1'))
          .filter((x) => x && !NONE.has(x))
    slices.push({
      id,
      name: c[at.name] ?? '',
      type,
      after,
      goal: at.goal < 0 ? '' : (c[at.goal] ?? ''),
    })
  }
  const ids = new Set(slices.map((s) => s.id))
  for (const s of slices) {
    for (const a of s.after) {
      if (a === s.id) issues.push(`조각 \`${s.id}\`가 자기를 먼저로 둠`)
      else if (!ids.has(a)) issues.push(`조각 \`${s.id}\`의 먼저 \`${a}\`가 표에 없음`)
    }
  }
  if (hasCycle(slices)) issues.push('먼저 칸이 돌고 돈다')
  return slices.length ? { path, slices, issues } : null
}

function hasCycle(slices: readonly PlanSlice[]): boolean {
  const by = new Map(slices.map((s) => [s.id, s]))
  const state = new Map<string, 1 | 2>()
  const visit = (id: string): boolean => {
    const st = state.get(id)
    if (st === 1) return true
    if (st === 2) return false
    state.set(id, 1)
    for (const a of by.get(id)?.after ?? []) if (by.has(a) && visit(a)) return true
    state.set(id, 2)
    return false
  }
  return slices.some((s) => visit(s.id))
}

/** 같은 문서의 조각을 맡은 Work (main이 work.json과 git으로 채운다) */
export interface SliceWork {
  workId: string
  doc: string
  slice: string
  status: WorkStatus
  /** PR이 머지됐거나 Work 브랜치가 기준 브랜치에 들어 있다 */
  merged: boolean
}

export type SliceStatus = PlanSliceStatus

export const SLICE_STATUS_LABEL: Readonly<Record<SliceStatus, string>> = {
  merged: '머지됨',
  active: '진행 중',
  ready: '시작할 수 있음',
  waiting: '기다림',
}

export interface SliceState {
  slice: PlanSlice
  status: SliceStatus
  /** 이 조각을 맡은 Work (포기한 것은 뺀다) */
  works: string[]
  /** 기다림이면 아직 머지되지 않은 먼저 조각 */
  missing: string[]
}

/**
 * 조각마다 상태: 맡은 Work가 머지됐으면 머지됨, 맡은 Work가 있으면 진행 중, 먼저 조각이 모두 머지됐으면 시작할 수 있음,
 * 아니면 기다림. 포기한 Work는 없는 것으로 본다
 */
export function sliceStates(doc: PlanDoc, works: readonly SliceWork[]): SliceState[] {
  const mine = works.filter((w) => w.doc === doc.path && w.status !== 'abandoned')
  const merged = new Set(mine.filter((w) => w.merged).map((w) => w.slice))
  return doc.slices.map((slice) => {
    const own = mine.filter((w) => w.slice === slice.id)
    const missing = slice.after.filter((a) => !merged.has(a))
    const status: SliceStatus = merged.has(slice.id)
      ? 'merged'
      : own.length
        ? 'active'
        : missing.length
          ? 'waiting'
          : 'ready'
    return { slice, status, works: own.map((w) => w.workId), missing }
  })
}

/** 조각을 새 Work로 시작할 수 없는 까닭. 시작할 수 있으면 null */
export function sliceBlocked(doc: PlanDoc, state: SliceState | undefined): string | null {
  if (!state) return '표에 없는 조각입니다'
  if (doc.issues.length) return `구현 나눔 표에 문제가 있습니다: ${doc.issues.join('; ')}`
  if (state.status === 'merged') return '이미 머지된 조각입니다'
  if (state.status === 'waiting')
    return `먼저 머지돼야 하는 조각이 있습니다: ${state.missing.join(', ')}`
  return null
}

const quote = (s: PlanSlice) => `${s.id} 「${s.name}」`

/** 새 Work 대화상자에 채울 요청. 사람이 고칠 수 있다. intake가 문서 경로를 intent 제약으로 옮긴다 (D369) */
export function sliceRequest(doc: PlanDoc, sliceId: string): string {
  const slice = doc.slices.find((s) => s.id === sliceId)
  if (!slice) return ''
  const by = new Map(doc.slices.map((s) => [s.id, s]))
  const done = slice.after.map((a) => by.get(a)).filter((s): s is PlanSlice => !!s)
  return [
    `\`${doc.path}\`의 설계를 따른다. 이번 Work는 그 문서의 구현 나눔 가운데 ${quote(slice)}만 맡는다.`,
    '',
    ...(slice.goal ? [`목표: ${slice.goal}`] : []),
    ...(done.length ? [`먼저 머지된 조각: ${done.map(quote).join(', ')}`] : []),
  ]
    .join('\n')
    .trim()
}

/** 앞 조각 Work에서 읽은 것 (조각 Work의 context.md) */
export interface SliceDigest {
  slice: string
  workId: string
  merged: boolean
  /** 그 Work의 마지막 verify가 쓴 pr.md의 `## 요약`. 없으면 null */
  summary: string | null
  /** 그 Work의 승인된 intent의 `## 완료조건`. 없으면 null */
  criteria: string | null
}

export interface PlanContextInput {
  ref: PlanRef
  /** 지금 worktree에서 읽은 문서. 읽지 못했으면 null */
  doc: PlanDoc | null
  states: SliceState[]
  /** 이 조각보다 먼저인 조각(직접과 그 앞)을 맡은 Work들 */
  before: SliceDigest[]
}

/** 이 조각보다 먼저여야 하는 조각 전부 (먼저의 먼저 포함), 표의 차례대로 */
export function ancestorsOf(doc: PlanDoc, sliceId: string): string[] {
  const by = new Map(doc.slices.map((s) => [s.id, s]))
  const seen = new Set<string>()
  const walk = (id: string) => {
    for (const a of by.get(id)?.after ?? []) {
      if (seen.has(a)) continue
      seen.add(a)
      walk(a)
    }
  }
  walk(sliceId)
  return doc.slices.map((s) => s.id).filter((id) => seen.has(id))
}

/** context.md의 "묶음 (구현 나눔)" 절. 제목과 본문 */
export function planSection(input: PlanContextInput): [string, string] {
  const { ref, doc } = input
  const lines: string[] = [
    `이 Work는 \`${ref.doc}\`의 구현 나눔 가운데 조각 \`${ref.slice}\`를 맡는다. 문서의 결정을 따르고, 다른 조각의 범위는 하지 않는다. ` +
      '먼저 머지된 조각의 동작과 완료조건을 깨지 않는다. 깨야 한다면 사람에게 묻는다(설계 문서의 제약에 닿음, D371).',
  ]
  if (!doc) {
    lines.push(
      '',
      `지금 worktree에서 \`${ref.doc}\`의 구현 나눔 표를 읽지 못했다. 문서를 직접 읽는다.`,
    )
    return ['묶음 (구현 나눔)', lines.join('\n')]
  }
  lines.push('', '| 조각 | 이름 | 먼저 | 상태 |', '|---|---|---|---|')
  for (const s of input.states) {
    const me = s.slice.id === ref.slice ? ' (이 Work)' : ''
    lines.push(
      `| ${s.slice.id}${me} | ${s.slice.name} | ${s.slice.after.join(', ') || '-'} | ${SLICE_STATUS_LABEL[s.status]} |`,
    )
  }
  lines.push('', '### 앞 조각')
  if (!input.before.length) lines.push('', '없음')
  for (const d of input.before) {
    const s = doc.slices.find((x) => x.id === d.slice)
    lines.push(
      '',
      `#### ${s ? quote(s) : d.slice} — Work ${d.workId}${d.merged ? '' : ' (아직 머지되지 않음: 그 코드가 이 브랜치에 없을 수 있다)'}`,
      '',
      '요약:',
      '',
      d.summary?.trim() || '(없음)',
      '',
      '완료조건 (이 Work가 깨면 안 됨):',
      '',
      d.criteria?.trim() || '(없음)',
    )
  }
  const mine = doc.slices.find((s) => s.id === ref.slice)
  const later = doc.slices.filter(
    (s) => s.id !== ref.slice && ancestorsOf(doc, s.id).includes(ref.slice),
  )
  lines.push('', '### 뒤 조각 (이 Work의 범위가 아님)', '')
  lines.push(
    later.length ? later.map((s) => `- ${quote(s)}: ${s.goal || '목표 없음'}`).join('\n') : '없음',
  )
  if (mine?.goal) lines.push('', `이 조각의 목표: ${mine.goal}`)
  return ['묶음 (구현 나눔)', lines.join('\n')]
}
