// 창의 격리와 외부 주소 (I2). Electron을 부르지 않아 [단위]로 지킨다.

/** 렌더러는 Node와 preload의 내부에 닿지 않는다 */
export const WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const

/** 비교 URL과 PR 주소처럼 브라우저로 열 주소. http(s)가 아니면 던진다 */
export function externalUrl(raw: string): string {
  const u = new URL(raw)
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('http(s) 주소가 아님')
  return u.toString()
}
