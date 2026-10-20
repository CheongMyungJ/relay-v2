// 터미널의 파일 열기와 붙여넣은 그림 (D410~D412). Electron을 부르지 않아 [단위]로 지킨다.
// 터미널 출력은 에이전트가 쓴 글이라 믿지 않는다: 네트워크 경로는 보지 않고, 실행 파일은 실행하지 않는다.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 경로가 쓰는 OS. 시험에서 바꿔 넣는다 */
export type PathPlatform = 'win32' | 'posix'

export function pathPlatform(platform: NodeJS.Platform = process.platform): PathPlatform {
  return platform === 'win32' ? 'win32' : 'posix'
}

/**
 * 터미널에 보인 경로 글을 절대 경로로 바꾼다. 상대 경로는 그 터미널의 폴더(cwd)에서, `~`는 홈에서 푼다.
 * 네트워크 경로(UNC, `//`)와 Windows 장치·스트림 경로는 null이다: 있는지 보기만 해도 원격에 접속하기 때문이다
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
  if (/^[\\/]{2}/.test(s)) return null
  if (s === '~') s = home
  else if (/^~[\\/]/.test(s)) s = p.join(home, s.slice(2))
  const abs = p.resolve(cwd, s)
  if (/^[\\/]{2}/.test(abs)) return null
  // 드라이브 뒤의 ':'는 NTFS 스트림이나 장치다
  if (platform === 'win32' && abs.indexOf(':', 2) >= 0) return null
  return abs
}

/** 열면 실행되는 파일. 열지 않고 폴더에서 보여 준다 */
const EXECUTABLE_EXT: Record<PathPlatform, ReadonlySet<string>> = {
  // Windows가 실행하거나 바로 해석하는 것
  win32: new Set([
    '.exe',
    '.com',
    '.bat',
    '.cmd',
    '.ps1',
    '.psm1',
    '.vbs',
    '.vbe',
    '.js',
    '.jse',
    '.wsf',
    '.wsh',
    '.msi',
    '.msc',
    '.msp',
    '.scr',
    '.pif',
    '.cpl',
    '.hta',
    '.lnk',
    '.url',
    '.reg',
    '.jar',
    '.appref-ms',
    '.application',
  ]),
  // Linux 데스크톱이 실행하는 것. 나머지 실행 파일은 실행 권한으로 가른다
  posix: new Set(['.desktop', '.appimage', '.run', '.bin']),
}

/** 열면 실행될 수 있는 파일인가. posix는 실행 권한이 있는 파일도 그렇다 */
export function executableLike(
  file: string,
  executableBit: boolean,
  platform: PathPlatform = pathPlatform(),
): boolean {
  if (platform === 'posix' && executableBit) return true
  const p = platform === 'win32' ? path.win32 : path.posix
  return EXECUTABLE_EXT[platform].has(p.extname(file).toLowerCase())
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
