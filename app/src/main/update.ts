// 자동 업데이트 (I95). Windows 설치본만 GitHub Releases의 latest.yml을 보고 새 버전을 뒤에서 받는다.
// 받은 업데이트는 앱을 끝낼 때 설치한다. 실행 중인 세션을 끊지 않으려고 앱이 스스로 다시 시작하지는 않는다.
import { autoUpdater } from 'electron-updater'

/** 처음 확인은 창이 뜨고 조금 뒤에, 그다음은 이 간격으로 한다 */
const FIRST_CHECK_MS = 30_000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

/** 자동 업데이트를 켜는가. 개발 앱과 Windows가 아닌 곳은 끄고, RELAY_UPDATE=off로도 끈다([스모크] 등) */
export function updatesEnabled(
  env: NodeJS.ProcessEnv,
  packaged: boolean,
  platform: NodeJS.Platform,
): boolean {
  return packaged && platform === 'win32' && env['RELAY_UPDATE'] !== 'off'
}

/** 업데이트 확인을 시작한다. 새 버전을 다 받으면 그 버전으로 한 번 알린다 */
export function startUpdates(onDownloaded: (version: string) => void): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  let told: string | null = null
  autoUpdater.on('update-downloaded', (info) => {
    if (told === info.version) return
    told = info.version
    onDownloaded(info.version)
  })
  // 오프라인이거나 릴리스가 없을 때도 앱 사용은 막지 않는다
  autoUpdater.on('error', (e) => console.warn(`업데이트 확인 실패: ${e.message}`))
  const check = () => void autoUpdater.checkForUpdates().catch(() => {})
  setTimeout(check, FIRST_CHECK_MS)
  setInterval(check, CHECK_EVERY_MS)
}
