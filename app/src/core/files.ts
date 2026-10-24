// Work의 [파일] 탭 (D464~D468): worktree 안 경로의 검사, 글 파일 판정과 줄 끝, 트리의 차례. 파일은 읽지 않는다.
// 경로는 렌더러가 보낸 글이라 worktree 기준 상대 경로로만 받고, 링크를 따라간 뒤의 자리는 adapters/files가 다시 본다.
import type { FileChangeView, FileEntryView } from '../shared/views'

/** 여는 파일의 상한 (바이트). 넘으면 열지 않고 크기를 보인다 (D466) */
export const FILE_MAX_BYTES = 1024 * 1024

/** 한 폴더에서 보이는 항목의 상한. 넘는 것은 개수만 보인다 (D465) */
export const DIR_MAX_ENTRIES = 2000

/** 트리에 보이지 않고 열지도 않는 이름: git의 저장소 */
const HIDDEN = new Set(['.git'])

/** Windows가 어느 폴더에서나 장치로 여는 이름. 확장자가 붙어도(`nul.txt`) 장치다 */
const DEVICE_NAME =
  /^(con|prn|aux|nul|clock\$|conin\$|conout\$|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3])$/i

/** 장치 이름인가 (`nul`, `COM1.txt`, `aux .md`) */
export function windowsDeviceName(name: string): boolean {
  return DEVICE_NAME.test((name.split('.')[0] ?? '').trimEnd())
}

/** `\\서버\…`, `//서버/…`처럼 다른 컴퓨터를 가리키는 경로 */
export function networkPath(p: string): boolean {
  return /^[\\/]{2}/.test(p)
}

/**
 * 링크가 가리키는 글을 이 컴퓨터의 경로로. Windows는 `\\?\`, `\\.\`, `\??\` 앞머리를 떼고(junction은 `\\?\C:\…`로
 * 읽힌다), 네트워크 경로(`\\?\UNC\…` 포함)는 null이다 (D412, D468)
 */
export function localLinkTarget(target: string | null, win32: boolean): string | null {
  if (target === null) return null
  let t = target
  if (win32) {
    if (/^[\\/]{2}[?.][\\/]unc[\\/]/i.test(t) || /^\\\?\?\\unc\\/i.test(t)) return null
    t = t.replace(/^(?:[\\/]{2}[?.][\\/]|\\\?\?\\)(?=[a-z]:)/i, '')
  }
  return networkPath(t) ? null : t
}

/** 트리에서 뺀 이름 */
export function hiddenName(name: string): boolean {
  return HIDDEN.has(name.toLowerCase())
}

/**
 * worktree 기준 상대 경로를 이름 목록으로 (D468). 빈 글은 worktree 자체다. 구분자는 `/`이고 Windows는 `\`도 받는다.
 * 절대 경로, `..`, 빈 이름, NUL, `.git` 아래는 null이다. Windows는 장치 이름과 `:`(드라이브, 스트림)도 null이다
 */
export function fileSegments(rel: string, win32: boolean): string[] | null {
  if (rel.length > 4096 || rel.includes('\0')) return null
  if (rel === '') return []
  if (rel.startsWith('/') || (win32 && (rel.startsWith('\\') || rel.includes(':')))) return null
  const names = rel.split(win32 ? /[\\/]/ : '/')
  for (const n of names) {
    if (n === '' || n === '.' || n === '..' || hiddenName(n)) return null
    // Windows는 이름 끝의 점과 공백을 떼어 연다: `..` 이나 `.git `도 같은 이름이다
    if (win32 && (/[. ]$/.test(n) || windowsDeviceName(n))) return null
  }
  return names
}

/** 트리의 차례: 폴더 먼저, 그다음 이름 순(대소문자 무시, 숫자는 크기로) */
export function sortEntries<T extends FileEntryView>(entries: readonly T[]): T[] {
  const rank = (e: T) => (e.kind === 'dir' ? 0 : 1)
  return [...entries].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )
}

/** 파일의 줄 끝과 BOM. 저장할 때 그대로 붙인다 (D467) */
export interface TextShape {
  eol: '\n' | '\r\n'
  bom: boolean
}

/**
 * 파일 바이트를 편집할 글로 (D466). UTF-8이 아니거나 NUL이 있으면 글이 아니라 null이다. BOM은 떼고, 줄 끝은 `\n`으로
 * 바꾼다(편집 칸이 그렇게 바꾼다). 줄 끝은 `\r\n`이 하나라도 있으면 `\r\n`이다
 */
export function decodeText(bytes: Uint8Array): { text: string; shape: TextShape } | null {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    return null
  }
  if (text.includes('\0')) return null
  const bom = text.startsWith('\ufeff')
  if (bom) text = text.slice(1)
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  return { text: text.replace(/\r\n/g, '\n'), shape: { eol, bom } }
}

/** 편집한 글을 파일 바이트로. 원래 파일의 줄 끝과 BOM을 붙인다 (D467) */
export function encodeText(text: string, shape: TextShape): Uint8Array {
  let out = text.replace(/\r\n/g, '\n')
  if (shape.eol === '\r\n') out = out.replace(/\n/g, '\r\n')
  if (shape.bom) out = `\ufeff${out}`
  return new TextEncoder().encode(out)
}

/** 트리에 보일 바뀐 파일의 상한. 넘는 것은 표시하지 않는다 (D490) */
export const CHANGES_MAX = 5000

/**
 * 기준 커밋과 작업 트리의 차이(git diff --name-status --no-renames)와 추적하지 않는 파일을 트리의 표시로 (D490).
 * prefix는 묶음 Work의 서브모듈 자리다. 추적하지 않는 파일은 더한 것이고, 형식이 바뀐 것(T)과 충돌(U)은 고친 것이다.
 * `.git` 아래 등 트리가 받지 않는 경로는 뺀다. 같은 경로는 앞의 것이 이기지만, 지운 것이 디스크에 추적하지 않는 파일로
 * 남아 있으면 고친 것이다
 */
export function treeChanges(
  lanes: readonly {
    prefix: string
    diff: readonly { status: string; path: string }[]
    untracked: readonly string[]
  }[],
): FileChangeView[] {
  const out = new Map<string, FileChangeView['status']>()
  const add = (rel: string, status: FileChangeView['status']) => {
    if (!out.has(rel) && fileSegments(rel, false)) out.set(rel, status)
  }
  for (const lane of lanes) {
    const at = (p: string) => (lane.prefix ? `${lane.prefix}/${p}` : p)
    for (const d of lane.diff) {
      const s = d.status[0]
      add(at(d.path), s === 'A' ? 'A' : s === 'D' ? 'D' : 'M')
    }
    // 지운 것으로 온 경로가 추적하지 않는 파일로 디스크에 있으면(git rm --cached) 지운 것이 아니다
    for (const p of lane.untracked) {
      if (out.get(at(p)) === 'D') out.set(at(p), 'M')
      else add(at(p), 'A')
    }
  }
  return [...out]
    .map(([path, status]) => ({ path, status }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .slice(0, CHANGES_MAX)
}
