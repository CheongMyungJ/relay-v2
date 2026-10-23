// Work의 [파일] 탭 (D464~D468): worktree 안 경로의 검사, 글 파일 판정과 줄 끝, 트리의 차례. 파일은 읽지 않는다.
// 경로는 렌더러가 보낸 글이라 worktree 기준 상대 경로로만 받고, 링크를 따라간 뒤의 자리는 adapters/files가 다시 본다.
import type { FileEntryView } from '../shared/views'

/** 여는 파일의 상한 (바이트). 넘으면 열지 않고 크기를 보인다 (D466) */
export const FILE_MAX_BYTES = 1024 * 1024

/** 한 폴더에서 보이는 항목의 상한. 넘는 것은 개수만 보인다 (D465) */
export const DIR_MAX_ENTRIES = 2000

/** 트리에 보이지 않고 열지도 않는 이름: git의 저장소 */
const HIDDEN = new Set(['.git'])

/** Windows가 어느 폴더에서나 장치로 여는 이름. 확장자가 붙어도(`nul.txt`) 장치다 */
const DEVICE_NAME = /^(con|prn|aux|nul|clock\$|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])$/i

/** 장치 이름인가 (`nul`, `COM1.txt`, `aux .md`) */
export function windowsDeviceName(name: string): boolean {
  return DEVICE_NAME.test((name.split('.')[0] ?? '').trimEnd())
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
