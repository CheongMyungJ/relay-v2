// 앱은 하나만 켠다 (D133, I34). Electron의 인스턴스 잠금으로 막는다.

/** Electron app 가운데 잠금에 쓰는 것 */
export interface InstanceApp {
  requestSingleInstanceLock(): boolean
  on(event: 'second-instance', listener: () => void): unknown
  exit(exitCode?: number): void
}

/**
 * 잠금을 잡으면 true다. 두 번째로 켜면 첫 앱이 onSecond로 창을 앞으로 가져온다.
 * 잠금을 잡지 못하면 relay를 열기 전에(고아 확인, 시나리오 9-1 전에) 바로 끝내고 false를 돌려준다.
 * 열면 첫 앱의 살아 있는 세션을 고아로 보고 끝내기 때문이다
 */
export function holdSingleInstance(app: InstanceApp, onSecond: () => void): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.exit(0)
    return false
  }
  app.on('second-instance', onSecond)
  return true
}
