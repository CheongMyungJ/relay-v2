// 자동 업데이트 (I95, I105). Windows 설치본과 Linux .deb 설치본만 GitHub Releases의 latest.yml(Linux는
// latest-linux.yml)을 보고 새 버전을 뒤에서 받는다. 받은 업데이트는 앱을 끝낼 때 설치한다(.deb는 관리자 비밀번호를
// 묻는다, D351). WSL처럼 비밀번호 창을 띄울 수 없는 곳은 설치 명령을 보여 주고 사람이 설치한다(D353).
// 실행 중인 세션을 끊지 않으려고 앱이 스스로 다시 시작하지는 않는다.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { AppUpdater } from 'electron-updater'

/** 처음 확인은 창이 뜨고 조금 뒤에, 그다음은 받을 때까지 이 간격으로 한다 */
const FIRST_CHECK_MS = 30_000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

/** 릴리스가 아닌 빌드의 버전. 레포의 package.json 그대로라 app-build 결과물이 이 버전이다 */
export const UNRELEASED_VERSION = '0.0.0'

export interface UpdateTarget {
  env: NodeJS.ProcessEnv
  packaged: boolean
  platform: NodeJS.Platform
  version: string
  /** Linux 설치 형식. electron-builder가 resources/package-type에 적는다(.deb면 deb). 없으면 null */
  packageType: string | null
}

/** resources/package-type을 읽는다. electron-updater도 이 파일로 설치 형식을 고른다 */
export function readPackageType(resourcesPath: string): string | null {
  try {
    return fs.readFileSync(path.join(resourcesPath, 'package-type'), 'utf8').trim() || null
  } catch {
    return null
  }
}

/**
 * 자동 업데이트를 켜는가. Windows 설치본이나 Linux .deb 설치본이면서 태그로 릴리스한 버전일 때만 켠다.
 * 개발 앱, 그 밖의 OS와 설치 형식, app-build 결과물(0.0.0)은 끄고, RELAY_UPDATE=off로도 끈다([스모크] 등)
 */
export function updatesEnabled(t: UpdateTarget): boolean {
  return (
    t.packaged &&
    (t.platform === 'win32' || (t.platform === 'linux' && t.packageType === 'deb')) &&
    t.version !== UNRELEASED_VERSION &&
    (t.env['RELAY_UPDATE'] ?? '').trim().toLowerCase() !== 'off'
  )
}

/** 새 버전을 받았다는 알림의 본문. .deb는 끌 때 관리자 비밀번호를 묻는다 (D351) */
export function updateNoticeBody(platform: NodeJS.Platform): string {
  return platform === 'linux'
    ? '앱을 끝낼 때 관리자 비밀번호를 물은 뒤 설치하고, 다음 실행부터 새 버전입니다.'
    : '앱을 끝내면 설치되고 다음 실행부터 새 버전입니다.'
}

/** electron-updater가 .deb를 설치할 때 찾는 그래픽 비밀번호 도구. 없으면 터미널이 필요한 sudo를 쓴다 */
const GUI_SUDO = ['gksudo', 'kdesudo', 'pkexec', 'beesu']

/** WSL 안인가. WSL은 WSL_DISTRO_NAME을 주고, 커널 릴리스에 microsoft가 든다(WSL2: ...-microsoft-standard-WSL2) */
export function isWsl(env: NodeJS.ProcessEnv, osRelease: string): boolean {
  return Boolean(env['WSL_DISTRO_NAME']) || /microsoft/i.test(osRelease)
}

/** PATH에서 실행 파일을 찾는다 (findClaude와 같은 방식) */
export function hasCommand(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return (env['PATH'] ?? '')
    .split(':')
    .some((dir) => dir !== '' && fs.existsSync(path.join(dir, name)))
}

export interface InstallTarget {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  osRelease: string
  hasCommand: (name: string) => boolean
}

/**
 * 받은 .deb를 앱이 끌 때 설치하지 못하고 사람이 설치해야 하는가 (D353). WSL에는 비밀번호 창을 띄울 인증 도구가 없고,
 * 그래픽 비밀번호 도구가 없는 데스크톱에서는 electron-updater가 터미널 없이 sudo를 불러 실패한다
 */
export function needsManualInstall(t: InstallTarget): boolean {
  return t.platform === 'linux' && (isWsl(t.env, t.osRelease) || !GUI_SUDO.some(t.hasCommand))
}

/** 사람이 터미널에서 돌릴 설치 명령. 경로는 작은따옴표로 감싼다 */
export function manualInstallCommand(file: string): string {
  return `sudo apt install '${file.replace(/'/g, `'\\''`)}'`
}

export interface UpdateOptions {
  /** 앱을 끌 때 받은 버전을 설치한다. 사람이 설치해야 하는 곳(D353)에서는 끈다 */
  installOnQuit: boolean
}

/**
 * 업데이트 확인을 시작한다. 새 버전을 다 받으면 한 번 알리고 확인을 멈춘다.
 * 받아 둔 버전은 종료 때 설치되고(installOnQuit), 그 뒤 더 새 릴리스는 다음 실행에서 받는다.
 * electron-updater는 켜질 때만 불러온다. CJS 패키지라 import()로는 autoUpdater가 이름으로 나오지 않아
 * node-pty처럼 require로 읽는다
 */
export function startUpdates(
  onDownloaded: (version: string, file: string) => void,
  opts: UpdateOptions,
): void {
  const load = createRequire(__filename)
  const { autoUpdater } = load('electron-updater') as { autoUpdater: AppUpdater }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = opts.installOnQuit
  let timer: NodeJS.Timeout | undefined
  // 오프라인이거나 릴리스가 없을 때도 앱 사용은 막지 않는다
  autoUpdater.on('error', (e) => console.warn(`업데이트 확인 실패: ${e.message}`))
  // 확인과 뒤에서 하는 다운로드는 실패를 따로 돌려주므로 둘 다 받아 둔다. 실패는 error 이벤트로 남는다
  const check = () =>
    void autoUpdater
      .checkForUpdates()
      .then((r) => r?.downloadPromise?.catch(() => {}))
      .catch(() => {})
  autoUpdater.once('update-downloaded', (info) => {
    clearTimeout(timer)
    onDownloaded(info.version, info.downloadedFile)
  })
  const loop = () => {
    check()
    timer = setTimeout(loop, CHECK_EVERY_MS)
  }
  timer = setTimeout(loop, FIRST_CHECK_MS)
}
