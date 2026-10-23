// 터미널의 파일 열기와 붙여넣은 그림 (D410~D412). Electron을 부르지 않아 [단위]로 지킨다.
// 터미널 출력은 에이전트가 쓴 글이라 믿지 않는다: 네트워크 경로와 장치는 보지 않고, 안전한 형식만 연다.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { localLinkTarget, networkPath, windowsDeviceName } from '../core/files'

/** 경로가 쓰는 OS. 시험에서 바꿔 넣는다 */
export type PathPlatform = 'win32' | 'posix'

export function pathPlatform(platform: NodeJS.Platform = process.platform): PathPlatform {
  return platform === 'win32' ? 'win32' : 'posix'
}

/**
 * 터미널에 보인 경로 글을 절대 경로로 바꾼다. 상대 경로는 그 터미널의 폴더(cwd)에서, `~`는 홈에서 푼다.
 * 네트워크 경로(UNC, `//`)와 Windows 장치·스트림 경로는 null이다: 있는지 보기만 해도 원격에 접속하거나 장치를 연다
 */
export function linkPath(
  raw: string,
  cwd: string,
  home: string,
  platform: PathPlatform = pathPlatform(),
): string | null {
  const p = platform === 'win32' ? path.win32 : path.posix
  let s = raw.trim()
  if (!s || s.length > 1000 || s.includes('\0')) return null
  if (/^file:/i.test(s)) {
    try {
      s = fileURLToPath(s, { windows: platform === 'win32' })
    } catch {
      return null
    }
  }
  if (networkPath(s)) return null
  if (s === '~') s = home
  else if (/^~[\\/]/.test(s)) s = p.join(home, s.slice(2))
  const abs = p.resolve(cwd, s)
  if (networkPath(abs)) return null
  if (platform === 'win32') {
    // 드라이브 뒤의 ':'는 NTFS 스트림이나 장치다
    if (abs.indexOf(':', 2) >= 0) return null
    const names = abs.slice(p.parse(abs).root.length).split(p.sep)
    if (names.some(windowsDeviceName)) return null
  }
  return abs
}

/** 링크를 따라가지 않고 보는 파일 시스템. 시험에서 바꿔 넣는다 */
export interface LinkFs {
  /** 없으면 null */
  lstat(file: string): Promise<{ isSymbolicLink(): boolean } | null>
  /** 링크가 가리키는 글. 읽지 못하면 null */
  readlink(file: string): Promise<string | null>
}

/**
 * 절대 경로의 링크(심볼릭 링크, junction)를 앞에서부터 하나씩 따라가 실제 경로를 낸다. 링크를 따라가는 stat보다
 * 먼저 부른다: 가는 길에 네트워크 경로를 가리키는 링크가 있거나, 없는 경로이거나, 링크가 너무 깊으면 null이다 (D412)
 */
export async function realLinkPath(
  abs: string,
  fs: LinkFs,
  platform: PathPlatform = pathPlatform(),
  depth = 0,
): Promise<string | null> {
  if (depth > 32) return null
  const p = platform === 'win32' ? path.win32 : path.posix
  const root = p.parse(abs).root
  let cur = root
  for (const name of abs.slice(root.length).split(p.sep)) {
    if (!name) continue
    const next = p.join(cur, name)
    const st = await fs.lstat(next)
    if (!st) return null
    if (!st.isSymbolicLink()) {
      cur = next
      continue
    }
    const target = localLinkTarget(await fs.readlink(next), platform === 'win32')
    if (target === null) return null
    const resolved = p.resolve(cur, target)
    if (networkPath(resolved)) return null
    const real = await realLinkPath(resolved, fs, platform, depth + 1)
    if (real === null) return null
    cur = real
  }
  return cur
}

/**
 * 열어도 실행되지 않는 파일: 문서, 코드, 그림, 데이터. 이 목록에 없는 것은 열지 않고 폴더에서 보여 준다 (D412).
 * 실행되는 형식을 모두 막는 목록은 OS와 설치한 프로그램(.py, Git Bash의 .sh, Wine의 .exe 등)마다 달라 만들 수 없다
 */
const SAFE_EXT: Record<PathPlatform | 'common', ReadonlySet<string>> = {
  common: new Set(
    (
      'md markdown mdx txt log rst adoc tex bib csv tsv json jsonc json5 jsonl ndjson yaml yml toml ini cfg conf ' +
      'properties xml html htm css scss sass less svg diff patch lock sql graphql gql proto ipynb ' +
      'ts tsx mts cts mjs cjs jsx vue svelte astro c h cc cpp cxx hpp hh cs java kt kts go rs swift scala dart ' +
      'gradle cmake mk tf hcl nix zig ex exs erl hs ml fs ' +
      'png jpg jpeg gif webp bmp ico avif tif tiff heic mp4 mov webm mkv mp3 wav ogg flac m4a ' +
      'pdf docx xlsx pptx odt ods odp zip'
    )
      .split(' ')
      .map((e) => `.${e}`),
  ),
  // Windows는 WSH(.js)와 설치한 인터프리터(.py, .rb, .php 등)가 바로 실행한다
  win32: new Set(),
  posix: new Set(['.js', '.py', '.rb', '.pl', '.php', '.lua', '.r']),
}

/** 확장자 없이 흔한 문서·설정 파일 이름 */
const SAFE_NAMES = new Set([
  'makefile',
  'dockerfile',
  'license',
  'licence',
  'readme',
  'changelog',
  'authors',
  'codeowners',
  'gemfile',
  'procfile',
  'jenkinsfile',
  'vagrantfile',
])

/**
 * 열어도 되는가. 폴더는 이름에 확장자가 없을 때만 연다(macOS의 `.app` 같은 꾸러미는 폴더다). posix는 실행 권한이
 * 있는 파일을 열지 않는다. 확장자 없는 파일은 점 파일(`.gitignore`)과 흔한 이름만 연다
 */
export function opensSafely(
  file: string,
  dir: boolean,
  executableBit: boolean,
  platform: PathPlatform = pathPlatform(),
): boolean {
  const p = platform === 'win32' ? path.win32 : path.posix
  const name = p.basename(file)
  const ext = p.extname(name).toLowerCase()
  if (dir) return ext === ''
  if (platform === 'posix' && executableBit) return false
  if (ext === '') return name.startsWith('.') || SAFE_NAMES.has(name.toLowerCase())
  return SAFE_EXT.common.has(ext) || SAFE_EXT[platform].has(ext)
}

/** 붙여넣은 그림의 형식. 엔진(Claude Code, Codex)이 경로로 받는 것만이다. 다른 형식은 PNG로 바꿔 저장한다 */
export function pasteExt(mime: string): 'png' | 'jpg' | 'gif' | 'webp' | null {
  switch (mime.toLowerCase()) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/gif':
      return 'gif'
    case 'image/webp':
      return 'webp'
    default:
      return null
  }
}

/** 붙여넣은 그림 하나의 상한 (바이트) */
export const PASTE_MAX_BYTES = 30 * 1024 * 1024

/** 붙여넣은 그림을 두는 기간. 엔진은 붙여넣을 때 읽으므로 그 뒤에는 화면의 링크로만 쓰인다 */
export const PASTE_KEEP_MS = 7 * 24 * 60 * 60 * 1000
