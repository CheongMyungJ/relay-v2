// 지식 정리 (D397, D398, 실험 위임). 모델 없이 찾는 정리 후보와, 후보로 채우는 일반 Work의 요청. 지식 파일과 코드는 main이
// 읽어 넘긴다.
import {
  KNOWLEDGE_DIR,
  anchorOf,
  checkEntryFormat,
  notYetPaths,
  type KnowledgeEntry,
} from './knowledge'

export type TidyKind = 'same_anchor' | 'stale_anchor' | 'missing_path' | 'format'

export interface TidyCandidate {
  kind: TidyKind
  /** 그 후보의 지식 파일 (레포 기준 경로) */
  paths: string[]
  /** 무엇이 걸렸나: anchor 이름, 없는 경로, 형식 문제 */
  detail: string
}

/** 코드에서 확인한 것 (main이 기준 커밋에서 읽음) */
export interface TidyCode {
  /** 지식 밖의 파일에서 낱말로 찾은 anchor 이름(점으로 이은 이름은 마지막 이름) */
  found: ReadonlySet<string>
  /** 기준 커밋의 파일 경로 */
  files: ReadonlySet<string>
}

/** 점으로 이은 anchor는 마지막 이름으로 찾는다 (`Billing.round` → `round`) */
export function anchorName(anchor: string): string {
  return anchor.split('.').pop() ?? anchor
}

/**
 * 정리 후보: 같은 `anchor`를 가진 항목 여럿(D293의 한 항목 규칙이 어긋남), 지식 밖의 코드에 이름이 없는 `anchor`,
 * `## 아직 규칙을 따르지 않는 곳`에 적힌 경로가 없음(D296), 형식 문제(D293). 서로 어긋나는 뜻은 찾지 않는다(정리 Work가 읽는다)
 */
export function tidyCandidates(
  entries: readonly KnowledgeEntry[],
  code: TidyCode,
): TidyCandidate[] {
  const out: TidyCandidate[] = []
  const live = entries.filter((e) => !e.removed)
  const byAnchor = new Map<string, string[]>()
  for (const e of live) {
    const a = anchorOf(e.text)
    if (a) byAnchor.set(a, [...(byAnchor.get(a) ?? []), e.path])
  }
  for (const [a, paths] of byAnchor) {
    if (paths.length > 1) out.push({ kind: 'same_anchor', paths, detail: a })
  }
  for (const [a, paths] of byAnchor) {
    if (!code.found.has(anchorName(a))) out.push({ kind: 'stale_anchor', paths, detail: a })
  }
  for (const e of live) {
    const missing = notYetPaths(e.text).filter((p) => !code.files.has(p))
    if (missing.length)
      out.push({ kind: 'missing_path', paths: [e.path], detail: missing.join(', ') })
  }
  for (const e of live) {
    const issues = checkEntryFormat(e.path, e.text)
    if (issues.length)
      out.push({ kind: 'format', paths: [e.path], detail: issues.map((i) => i.message).join('; ') })
  }
  return out
}

/** 후보에 들어 있는 anchor 이름들 (main이 코드에서 찾을 것) */
export function anchorNames(entries: readonly KnowledgeEntry[]): string[] {
  const names = entries
    .filter((e) => !e.removed)
    .map((e) => anchorOf(e.text))
    .filter((a): a is string => a !== null)
    .map(anchorName)
  return [...new Set(names)].sort()
}

const list = (paths: readonly string[]) => paths.map((p) => `\`${p}\``).join(', ')

function line(c: TidyCandidate): string {
  switch (c.kind) {
    case 'same_anchor':
      return `- 같은 anchor \`${c.detail}\`를 가진 항목이 여럿: ${list(c.paths)} → 한 항목(한 경로)으로 합친다. 내용이 서로 다르면 어느 쪽이 지금 규칙인지 사람에게 묻는다`
    case 'stale_anchor':
      return `- 코드에서 찾지 못한 anchor \`${c.detail}\`: ${list(c.paths)} → 이름이 바뀌었으면 anchor와 내용을 고치고, 그 코드가 없어졌으면 지운다. 어느 쪽인지 코드로 알 수 없으면 사람에게 묻는다`
    case 'missing_path':
      return `- \`아직 규칙을 따르지 않는 곳\`에 적힌 경로가 없음(${c.detail}): ${list(c.paths)} → 옮겨졌으면 경로를 고치고, 이미 고쳐졌거나 없어졌으면 그 줄을 지운다`
    case 'format':
      return `- 형식 문제(${c.detail}): ${list(c.paths)} → 지식 형식에 맞게 고친다`
  }
}

/** 지식 정리 Work(일반)의 요청. 사람이 고칠 수 있다 */
export function tidyRequest(candidates: readonly TidyCandidate[]): string {
  return [
    `\`${KNOWLEDGE_DIR}/\`의 팀 지식을 정리한다. 앱이 모델 없이 찾은 후보는 아래와 같다(이름만 보고 찾은 것이라 틀릴 수 있다).`,
    '',
    ...(candidates.length ? candidates.map(line) : ['- 없음']),
    '',
    '후보 밖에서도 같은 영역의 항목끼리 읽어 서로 어긋나는 규칙이 있는지 본다. 있으면 어느 쪽이 지금 맞는지 사람에게 묻고, 답대로 한 항목으로 정리한다.',
    '문제가 없는 항목은 바꾸지 않는다. 코드는 바꾸지 않는다. 항목을 지우거나 합칠 때는 남는 항목의 `## 바뀐 이력`에 한 줄을 남긴다.',
    '끝났다고 볼 조건: 후보마다 합침 / 고침 / 지움 / 그대로(까닭) 가운데 하나로 정리했고, 지식 형식 확인을 통과한다.',
  ].join('\n')
}
