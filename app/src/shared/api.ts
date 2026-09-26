// preload가 contextBridge로 렌더러에 내보내는 API (I2, I14).
// 메인과 렌더러가 같은 타입을 보도록 여기에 둔다.

export interface AppInfo {
  platform: string
  /** Windows 빌드 번호. xterm의 windowsPty에 넘긴다. Windows가 아니면 null */
  windowsBuild: number | null
}

export type StartResult = { ok: true; pid: number; bin: string } | { ok: false; error: string }

export interface TerminalApi {
  /** 폴더 선택 창. 취소하면 null */
  pickFolder(): Promise<string | null>
  /** 세션 자리를 만든다. 출력 구독(onData) 뒤에 start를 불러야 첫 출력을 놓치지 않는다 */
  create(cwd: string): Promise<string>
  start(id: string, cols: number, rows: number): Promise<StartResult>
  write(id: string, data: string): Promise<void>
  resize(id: string, cols: number, rows: number): Promise<void>
  /** 프로세스 트리를 끝내고 세션을 지운다 */
  close(id: string): Promise<void>
  /** 구독을 끊는 함수를 돌려준다 */
  onData(id: string, cb: (data: string) => void): () => void
  onExit(id: string, cb: (exitCode: number) => void): () => void
}

export interface RelayApi {
  appInfo(): Promise<AppInfo>
  terminal: TerminalApi
}

export const API_KEY = 'relay'

// IPC 채널. 터미널 출력과 종료는 세션별 채널로 보낸다 (I14).
export const IPC = {
  appInfo: 'app:info',
  pickFolder: 'terminal:pick-folder',
  create: 'terminal:create',
  start: 'terminal:start',
  write: 'terminal:write',
  resize: 'terminal:resize',
  close: 'terminal:close',
  data: (id: string) => `terminal:data:${id}`,
  exit: (id: string) => `terminal:exit:${id}`,
} as const
