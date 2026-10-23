// Work의 [파일] 탭의 파일 읽기와 쓰기 (D464~D468). worktree 안의 폴더를 읽고, 글 파일을 읽고 고친다.
// 경로는 worktree 기준 상대 경로만 받는다(core/files). 링크(심볼릭 링크, junction)는 따라가는 stat 전에 readlink로 하나씩
// 풀고, 가리키는 곳이 worktree 밖이면 보지 않는다: 밖의 파일을 읽거나 쓰지 않고, 네트워크 경로에 닿지 않는다 (D412, D468).
import { createHash } from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  DIR_MAX_ENTRIES,
  FILE_MAX_BYTES,
  decodeText,
  encodeText,
  fileSegments,
  hiddenName,
  sortEntries,
} from '../core/files'
import type { FileEntryView, FileListResult, FileReadResult, FileSaveResult } from '../shared/views'

const WIN32 = process.platform === 'win32'

/** 링크를 따라가는 횟수의 상한 */
const MAX_HOPS = 32

const hashOf = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/** worktree의 실제 경로. 없으면 null */
async function rootOf(worktree: string): Promise<string | null> {
  const root = await fsp.realpath(worktree).catch(() => null)
  const st = root ? await fsp.stat(root).catch(() => null) : null
  return st?.isDirectory() ? root : null
}

/**
 * worktree 안 이름 목록의 실제 자리. 링크는 readlink로 따라가고, 가리키는 곳을 다시 worktree 기준 이름으로 바꿔 검사한다
 * (`..`로 나가거나 다른 드라이브·네트워크·`.git`이면 null). 없는 자리도 null이다. 돌려준 경로의 이름은 모두 링크가 아니다
 */
async function inside(root: string, names: readonly string[], hops = 0): Promise<string | null> {
  let cur = root
  for (const [i, name] of names.entries()) {
    const next = path.join(cur, name)
    const st = await fsp.lstat(next).catch(() => null)
    if (!st) return null
    if (!st.isSymbolicLink()) {
      cur = next
      continue
    }
    if (hops >= MAX_HOPS) return null
    let target = await fsp.readlink(next).catch(() => null)
    if (target === null) return null
    // junction은 `\\?\C:\…`로 읽힌다
    if (WIN32) target = target.replace(/^(?:\\\\\?\\|\\\?\?\\)(?=[a-z]:)/i, '')
    const rel = path.relative(root, path.resolve(cur, target))
    if (path.isAbsolute(rel)) return null
    const inner = fileSegments(rel.split(path.sep).join('/'), WIN32)
    if (!inner) return null
    return inside(root, [...inner, ...names.slice(i + 1)], hops + 1)
  }
  return cur
}

/** 상대 경로의 실제 자리와 stat. 받지 않거나 없는 경로는 그 까닭이다 */
async function locate(
  worktree: string,
  rel: string,
): Promise<{ root: string; names: string[]; real: string } | { error: string }> {
  const names = fileSegments(rel, WIN32)
  if (!names) return { error: `받지 않는 경로: ${rel}` }
  const root = await rootOf(worktree)
  if (!root) return { error: 'worktree가 없습니다' }
  const real = await inside(root, names)
  if (!real) return { error: `없거나 worktree 밖을 가리키는 경로: ${rel}` }
  return { root, names, real }
}

/** 폴더 하나의 항목 (D465). 링크는 가리키는 것의 종류로 보이고, 밖을 가리키거나 깨졌으면 other다 */
export async function listFiles(worktree: string, rel: string): Promise<FileListResult> {
  const at = await locate(worktree, rel)
  if ('error' in at) return { ok: false, error: at.error }
  const ents = await fsp.readdir(at.real, { withFileTypes: true }).catch(() => null)
  if (!ents) return { ok: false, error: `폴더를 읽지 못함: ${rel || '.'}` }
  const entries = await Promise.all(
    ents
      .filter((e) => !hiddenName(e.name))
      .map(async (e): Promise<FileEntryView> => {
        if (e.isDirectory()) return { name: e.name, kind: 'dir' }
        if (e.isFile()) return { name: e.name, kind: 'file' }
        if (!e.isSymbolicLink()) return { name: e.name, kind: 'other' }
        const real = await inside(at.root, [...at.names, e.name])
        const st = real ? await fsp.stat(real).catch(() => null) : null
        const kind = st?.isDirectory() ? 'dir' : st?.isFile() ? 'file' : 'other'
        return { name: e.name, kind }
      }),
  )
  const sorted = sortEntries(entries)
  return {
    ok: true,
    entries: sorted.slice(0, DIR_MAX_ENTRIES),
    more: Math.max(0, sorted.length - DIR_MAX_ENTRIES),
  }
}

/** 파일을 읽는다 (D466). 상한을 넘거나 글이 아니면 크기만 돌려준다 */
export async function readTextFile(worktree: string, rel: string): Promise<FileReadResult> {
  const at = await locate(worktree, rel)
  if ('error' in at) return { ok: false, error: at.error }
  const st = await fsp.stat(at.real).catch(() => null)
  if (!st?.isFile()) return { ok: false, error: `파일이 아님: ${rel}` }
  if (st.size > FILE_MAX_BYTES) return { ok: true, kind: 'large', size: st.size }
  const bytes = await fsp.readFile(at.real).catch(() => null)
  if (!bytes) return { ok: false, error: `파일을 읽지 못함: ${rel}` }
  if (bytes.byteLength > FILE_MAX_BYTES) return { ok: true, kind: 'large', size: bytes.byteLength }
  const decoded = decodeText(bytes)
  if (!decoded) return { ok: true, kind: 'binary', size: bytes.byteLength }
  return { ok: true, kind: 'text', text: decoded.text, hash: hashOf(bytes) }
}

/**
 * 고친 글을 저장한다 (D467). 있는 글 파일만 고친다. expectHash가 지금 파일과 다르면(연 뒤 바뀜) 쓰지 않고 conflict다.
 * null이면 비교하지 않고 덮어쓴다. 줄 끝과 BOM은 지금 파일의 것을 붙인다. 그 자리에 써서 링크와 권한은 그대로다
 */
export async function writeTextFile(
  worktree: string,
  rel: string,
  text: string,
  expectHash: string | null,
): Promise<FileSaveResult> {
  const at = await locate(worktree, rel)
  if ('error' in at) return { ok: false, error: at.error }
  const st = await fsp.stat(at.real).catch(() => null)
  if (!st?.isFile()) return { ok: false, error: `파일이 아님: ${rel}` }
  if (st.size > FILE_MAX_BYTES) return { ok: false, error: `파일이 너무 큼: ${rel}` }
  const current = await fsp.readFile(at.real).catch(() => null)
  if (!current) return { ok: false, error: `파일을 읽지 못함: ${rel}` }
  const decoded = decodeText(current)
  if (!decoded) return { ok: false, error: `글 파일이 아님: ${rel}` }
  if (expectHash !== null && hashOf(current) !== expectHash) {
    return { ok: false, conflict: true, error: '연 뒤 파일이 바뀌었습니다' }
  }
  const bytes = encodeText(text, decoded.shape)
  if (bytes.byteLength > FILE_MAX_BYTES) return { ok: false, error: '글이 너무 큼' }
  try {
    await fsp.writeFile(at.real, bytes)
  } catch (e) {
    return { ok: false, error: `저장하지 못함: ${e instanceof Error ? e.message : String(e)}` }
  }
  return { ok: true, hash: hashOf(bytes) }
}
