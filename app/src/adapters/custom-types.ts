// 커스텀 유형 폴더 읽기와 쓰기 (5.6.13, D449~D451, D458, D459, I162). 전역은 <RELAY_HOME>/types/<id>/, 레포는
// <프로젝트 레포>/.relay/types/<id>/다. 정의 검사는 core/custom-type이 한다
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  INTAKE_NOTES_FILE,
  TYPE_FILE,
  VERIFY_NOTES_FILE,
  missingProcedures,
  parseCustomType,
  serializeCustomType,
  typeIdError,
} from '../core/custom-type'
import type { CustomTypeFiles, CustomTypeView } from '../shared/views'
import type { CustomTypeDef, CustomTypeSource, WorkCustomType } from '../shared/work'
import { sha256, writeFileAtomic } from './store'

/** 전역 유형 폴더 (D449) */
export const globalTypesDir = (home: string) => path.join(home, 'types')

/** 레포 유형 폴더 (D450) */
export const repoTypesDir = (repo: string) => path.join(repo, '.relay', 'types')

/** 읽은 유형 하나. 형식이 깨졌으면 def가 null이고 errors에 까닭이 있다 (D460) */
export interface CustomTypeEntry {
  id: string
  source: CustomTypeSource
  /** 유형 폴더 */
  dir: string
  def: CustomTypeDef | null
  errors: string[]
}

const notFound = (err: unknown) => (err as NodeJS.ErrnoException).code === 'ENOENT'

/**
 * 유형 폴더의 파일 하나. 없거나 일반 파일이 아니면(심볼릭 링크, 폴더) null이다. 레포 유형은 믿지 않는 레포의 파일이라
 * 링크를 따라가 다른 파일의 내용을 절차로 넣지 않는다
 */
async function readOptional(file: string): Promise<string | null> {
  const stat = await fsp.lstat(file).catch((err: unknown) => {
    if (notFound(err)) return null
    throw err
  })
  return stat?.isFile() ? fsp.readFile(file, 'utf8') : null
}

/** 폴더의 파일 이름 (하위 폴더는 뺀다). 폴더가 없으면 빈 목록이다 */
async function fileNames(dir: string): Promise<string[]> {
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch((err: unknown) => {
    if (notFound(err)) return []
    throw err
  })
  return entries.filter((e) => e.isFile()).map((e) => e.name)
}

/** 유형 폴더 하나를 읽고 검사한다: type.json과 단계마다의 절차 파일 (D449) */
export async function readCustomType(
  dir: string,
  source: CustomTypeSource,
): Promise<CustomTypeEntry> {
  const id = path.basename(dir)
  const text = await readOptional(path.join(dir, TYPE_FILE))
  if (text === null) return { id, source, dir, def: null, errors: [`${TYPE_FILE} 없음`] }
  const r = parseCustomType(id, text)
  if (!r.ok) return { id, source, dir, def: null, errors: r.errors }
  const procedures: string[] = []
  for (const s of r.def.steps) {
    if ((await readOptional(path.join(dir, `${s.id}.md`))) !== null) procedures.push(`${s.id}.md`)
  }
  const missing = missingProcedures(r.def, procedures)
  return missing.length
    ? { id, source, dir, def: null, errors: missing }
    : { id, source, dir, def: r.def, errors: [] }
}

/**
 * id로 유형 하나를 찾는다 (D451): 레포의 폴더가 있으면 그것, 없으면 전역의 것이다. 어디에도 없거나 id가 틀리면 undefined다.
 * Work를 만들 때 쓴다: 목록 전체를 읽지 않는다
 */
export async function findCustomType(
  home: string,
  repo: string,
  id: string,
): Promise<CustomTypeEntry | undefined> {
  if (typeIdError(id)) return undefined
  for (const [root, source] of [
    [repoTypesDir(repo), 'repo'],
    [globalTypesDir(home), 'global'],
  ] as const) {
    const dir = path.join(root, id)
    const stat = await fsp.lstat(dir).catch(() => null)
    if (stat?.isDirectory()) return readCustomType(dir, source)
  }
  return undefined
}

/** 한 위치의 유형들. 폴더 이름 차례다. `.`으로 시작하는 폴더는 뺀다 */
async function readAll(root: string, source: CustomTypeSource): Promise<CustomTypeEntry[]> {
  const entries = await fsp.readdir(root, { withFileTypes: true }).catch((err: unknown) => {
    if (notFound(err)) return []
    throw err
  })
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
  return Promise.all(dirs.map((d) => readCustomType(path.join(root, d), source)))
}

/** 전역 유형 */
export const listGlobalTypes = (home: string) => readAll(globalTypesDir(home), 'global')

/** 레포 유형. 읽지 못하면(레포가 없음 등) 빈 목록이다 */
export const listRepoTypes = (repo: string) =>
  readAll(repoTypesDir(repo), 'repo').catch(() => [] as CustomTypeEntry[])

/**
 * 한 프로젝트에서 고를 수 있는 유형 (D451, D460): 레포 유형 뒤에 전역 유형. 같은 id면 레포 것을 쓰고 전역 것은 shadowed에
 * 남긴다
 */
export function mergeTypes(
  repo: readonly CustomTypeEntry[],
  global: readonly CustomTypeEntry[],
): { types: CustomTypeEntry[]; shadowed: CustomTypeEntry[] } {
  const ids = new Set(repo.map((t) => t.id))
  return {
    types: [...repo, ...global.filter((t) => !ids.has(t.id))],
    shadowed: global.filter((t) => ids.has(t.id)),
  }
}

/** 화면에 보이는 유형 (D459, D460) */
export function customTypeView(entry: CustomTypeEntry, shadowed = false): CustomTypeView {
  const def = entry.def
  return {
    id: entry.id,
    source: entry.source,
    name: def?.name ?? entry.id,
    description: def?.description ?? '',
    steps: (def?.steps ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      autoApprove: s.auto_approve,
    })),
    errors: entry.errors,
    ...(shadowed ? { shadowed: true } : {}),
  }
}

/** 유형 폴더에서 복사하는 파일: type.json, 단계마다의 절차, 선택 파일 둘 (D458) */
function copiedFiles(def: CustomTypeDef): string[] {
  return [TYPE_FILE, ...def.steps.map((s) => `${s.id}.md`), INTAKE_NOTES_FILE, VERIFY_NOTES_FILE]
}

/** 파일들의 해시: 이름 차례로 이름과 내용을 잇는다. 줄 끝은 LF로 맞춘다 */
function folderHash(files: readonly { name: string; text: string }[]): string {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
  return `sha256:${sha256(sorted.map((f) => `${f.name}\0${f.text.replace(/\r\n?/g, '\n')}\0`).join(''))}`
}

/**
 * Work를 만들 때 유형 폴더를 Work 디렉터리의 type/에 복사한다 (D458). 복사 전에 다시 읽어 검사하고, 깨졌으면 오류다.
 * 돌려주는 값은 work.json의 custom_type이다
 */
export async function snapshotCustomType(
  entry: Pick<CustomTypeEntry, 'dir' | 'source'>,
  dest: string,
): Promise<WorkCustomType> {
  // 검사하고 복사하는 글은 한 번 읽은 것이다: 그 사이에 원본이 바뀌어도 work.json의 단계와 복사본이 어긋나지 않는다
  const id = path.basename(entry.dir)
  const broken = (errors: string[]) =>
    new Error(`유형 \`${id}\`의 형식이 깨졌습니다: ${errors.join('; ')}`)
  const text = await readOptional(path.join(entry.dir, TYPE_FILE))
  if (text === null) throw broken([`${TYPE_FILE} 없음`])
  const r = parseCustomType(id, text)
  if (!r.ok) throw broken(r.errors)
  const files: { name: string; text: string }[] = [{ name: TYPE_FILE, text }]
  for (const name of copiedFiles(r.def).slice(1)) {
    const body = await readOptional(path.join(entry.dir, name))
    if (body !== null) files.push({ name, text: body })
  }
  const missing = missingProcedures(
    r.def,
    files.map((f) => f.name),
  )
  if (missing.length) throw broken(missing)
  await fsp.mkdir(dest, { recursive: true })
  for (const f of files) await writeFileAtomic(path.join(dest, f.name), f.text)
  return { ...r.def, source: entry.source, hash: folderHash(files) }
}

/** 유형 폴더의 글을 읽는다. type.json이 깨졌으면 null이다 */
export async function readCustomTypeFiles(dir: string): Promise<CustomTypeFiles | null> {
  const text = await readOptional(path.join(dir, TYPE_FILE))
  if (text === null) return null
  const r = parseCustomType(path.basename(dir), text)
  if (!r.ok) return null
  const procedures: Record<string, string> = {}
  for (const s of r.def.steps)
    procedures[s.id] = (await readOptional(path.join(dir, `${s.id}.md`))) ?? ''
  return {
    def: r.def,
    procedures,
    intake: (await readOptional(path.join(dir, INTAKE_NOTES_FILE))) ?? '',
    verify: (await readOptional(path.join(dir, VERIFY_NOTES_FILE))) ?? '',
  }
}

/**
 * 전역 유형 폴더를 쓴다 (D459). type.json을 검사한 글로 쓰고, 단계마다 절차를 쓰며, 정의에 없는 단계의 절차 파일은 지운다.
 * 비운 선택 파일은 지운다. 형식이 틀리면 쓰지 않고 오류다
 */
export async function saveCustomType(root: string, files: CustomTypeFiles): Promise<void> {
  const id = files.def.id
  const idError = typeIdError(id)
  if (idError) throw new Error(idError)
  const text = serializeCustomType(files.def)
  const r = parseCustomType(id, text)
  if (!r.ok) throw new Error(r.errors.join('; '))
  const dir = path.join(root, id)
  await fsp.mkdir(dir, { recursive: true })
  await writeFileAtomic(path.join(dir, TYPE_FILE), text)
  const keep = new Set(copiedFiles(r.def))
  for (const s of r.def.steps) {
    await writeFileAtomic(path.join(dir, `${s.id}.md`), files.procedures[s.id] ?? '')
  }
  for (const [name, body] of [
    [INTAKE_NOTES_FILE, files.intake],
    [VERIFY_NOTES_FILE, files.verify],
  ] as const) {
    if (body.trim()) await writeFileAtomic(path.join(dir, name), body)
    else await fsp.rm(path.join(dir, name), { force: true })
  }
  // 빠진 단계의 절차 파일. 사람이 둔 다른 파일(.md가 아닌 것)은 그대로 둔다
  for (const name of await fileNames(dir)) {
    if (name.endsWith('.md') && !keep.has(name)) await fsp.rm(path.join(dir, name), { force: true })
  }
}

/** 전역 유형 폴더의 id를 바꾼다 (D459). 옛 폴더가 없으면 아무것도 하지 않는다 */
export async function renameCustomType(root: string, from: string, to: string): Promise<void> {
  for (const id of [from, to]) {
    const idError = typeIdError(id)
    if (idError) throw new Error(idError)
  }
  await fsp.rename(path.join(root, from), path.join(root, to)).catch((err: unknown) => {
    if (!notFound(err)) throw err
  })
}

/** 전역 유형 폴더를 지운다 (D459) */
export async function deleteCustomType(root: string, id: string): Promise<void> {
  const idError = typeIdError(id)
  if (idError) throw new Error(idError)
  await fsp.rm(path.join(root, id), { recursive: true, force: true })
}

/**
 * [레포로 복사] (D450): 전역 유형 폴더의 파일을 레포의 .relay/types/<id>/에 복사한다. 이미 있으면 덮어쓰지 않고 오류다.
 * 커밋은 사람이 한다
 */
export async function copyTypeToRepo(entry: CustomTypeEntry, repo: string): Promise<string> {
  if (!entry.def) throw new Error(`유형 \`${entry.id}\`의 형식이 깨져 복사하지 않습니다`)
  const dest = path.join(repoTypesDir(repo), entry.id)
  const exists = await fsp.stat(dest).then(
    () => true,
    (err: unknown) => (notFound(err) ? false : Promise.reject(err)),
  )
  if (exists) throw new Error(`레포에 같은 id의 유형이 이미 있습니다: ${dest}`)
  await fsp.mkdir(dest, { recursive: true })
  for (const name of copiedFiles(entry.def)) {
    const text = await readOptional(path.join(entry.dir, name))
    if (text !== null) await writeFileAtomic(path.join(dest, name), text)
  }
  return dest
}
