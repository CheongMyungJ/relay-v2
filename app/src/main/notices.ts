// OS 알림을 붙잡아 두는 방법과 Windows 앱 ID (D81, D142, I37).

/** Windows 앱 ID. 설치 파일(electron-builder.yml)의 appId와 같아야 토스트와 클릭이 이 앱으로 온다 */
export const APP_USER_MODEL_ID = 'io.github.cheongmyungj.relay'

/** 붙잡아 두는 알림 수. 넘으면 가장 오래된 것부터 놓는다 */
export const KEEP_NOTICES = 50

/** Electron Notification 가운데 붙잡는 데 쓰는 것 */
export interface HeldNotice {
  on(event: 'click' | 'failed', listener: () => void): unknown
}

/**
 * 알림을 눌리거나 실패할 때까지 붙잡아 둔다. GC된 알림은 알림 센터에서 눌러도 click이 오지 않을 수 있다.
 * Windows는 토스트가 알림 센터로 옮겨 갈 때 close를 보내므로 close로는 놓지 않는다
 */
export function keepNotice<T extends HeldNotice>(kept: Set<T>, notice: T): T {
  kept.add(notice)
  const drop = () => kept.delete(notice)
  notice.on('click', drop)
  notice.on('failed', drop)
  for (const old of kept) {
    if (kept.size <= KEEP_NOTICES) break
    kept.delete(old)
  }
  return notice
}
