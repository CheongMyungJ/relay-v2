// preload가 contextBridge로 렌더러에 내보내는 API (I2, I14).
// 메인과 렌더러가 같은 타입을 보도록 여기에 둔다.
export interface RelayApi {
  readonly platform: string
}

export const API_KEY = 'relay'
