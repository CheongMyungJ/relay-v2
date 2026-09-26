// preload가 contextBridge로 렌더러에 내보내는 API (I2, I14).
// 렌더러는 명령을 invoke로 보내고, 메인은 상태가 바뀔 때마다 Work 스냅샷을 보낸다.
// 터미널 출력은 task별 채널로 보낸다. 메인과 렌더러가 같은 타입을 보도록 여기에 둔다.
import type { AppConfig, WorkSettings } from './config'
import type {
  AppSnapshot,
  ApproveOptions,
  CommandResult,
  CreateWorkResult,
  NewWorkInput,
  ProjectInspection,
  ProjectView,
  ReviewView,
  TerminalBacklog,
  TerminalChunk,
  WorkView,
} from './views'

export interface AppInfo {
  platform: string
  /** Windows 빌드 번호. xterm의 windowsPty에 넘긴다. Windows가 아니면 null */
  windowsBuild: number | null
}

export interface TerminalApi {
  /**
   * 지금까지의 출력을 받는다. onData로 먼저 구독한 뒤 불러야 사이에 온 조각을 놓치지 않는다.
   * seq가 next보다 작은 조각은 이미 data에 들어 있다.
   */
  attach(key: string): Promise<TerminalBacklog>
  write(key: string, data: string): Promise<void>
  resize(key: string, cols: number, rows: number): Promise<void>
  /** 구독을 끊는 함수를 돌려준다 */
  onData(key: string, cb: (chunk: TerminalChunk) => void): () => void
}

export interface RelayApi {
  appInfo(): Promise<AppInfo>
  snapshot(): Promise<AppSnapshot>
  onWork(cb: (work: WorkView) => void): () => void
  onProjects(cb: (projects: ProjectView[]) => void): () => void
  /** 폴더 선택 창. 취소하면 null */
  pickFolder(): Promise<string | null>
  inspectProject(path: string): Promise<ProjectInspection>
  registerProject(path: string, defaultBranch: string): Promise<CommandResult>
  /** 기준 브랜치 목록. 프로젝트의 기본 브랜치가 맨 앞이다 */
  branches(projectId: string): Promise<string[]>
  createWork(projectId: string, input: NewWorkInput): Promise<CreateWorkResult>
  review(workKey: string, taskId: string): Promise<ReviewView | null>
  approve(workKey: string, taskId: string, opts: ApproveOptions): Promise<CommandResult>
  /** [즉시 중단] (시나리오 3-4) */
  interrupt(workKey: string, taskId: string): Promise<CommandResult>
  /** [재개], [세션 재개] (시나리오 3-4, 3-5, 4.4) */
  resume(workKey: string, taskId: string): Promise<CommandResult>
  /** [이 단계 새 세션으로 다시] (시나리오 3-5, D114) */
  retry(workKey: string, taskId: string): Promise<CommandResult>
  /** [이 단계 끝나면 멈춤]을 켜거나 끈다 (시나리오 3-4) */
  stopAfter(workKey: string, on: boolean): Promise<CommandResult>
  /** 멈춘 Work의 [재개] (3.3) */
  resumeWork(workKey: string): Promise<CommandResult>
  /** [Work 포기] (3.3) */
  abandon(workKey: string): Promise<CommandResult>
  /** Work별 질문 방식 (D72) */
  updateWorkSettings(workKey: string, settings: WorkSettings): Promise<CommandResult>
  /** 앱 설정 (D70) */
  config(): Promise<AppConfig>
  /** 설정 화면에서 바꾼 값. 바로 적용한다 (D73) */
  updateConfig(patch: Partial<AppConfig>): Promise<CommandResult>
  /** 사람이 보고 있는 Work. 그 Work의 알림은 보내지 않는다 (D81) */
  selectWork(workKey: string | null): void
  /** 알림을 누르면 그 Work를 고르게 한다 */
  onFocusWork(cb: (workKey: string) => void): () => void
  terminal: TerminalApi
}

export const API_KEY = 'relay'

// IPC 채널. 터미널 출력은 task별 채널로 보낸다 (I14).
export const IPC = {
  appInfo: 'app:info',
  snapshot: 'app:snapshot',
  work: 'app:work',
  projects: 'app:projects',
  pickFolder: 'project:pick-folder',
  inspectProject: 'project:inspect',
  registerProject: 'project:register',
  branches: 'project:branches',
  createWork: 'work:create',
  review: 'work:review',
  approve: 'work:approve',
  interrupt: 'work:interrupt',
  resume: 'work:resume',
  retry: 'work:retry',
  stopAfter: 'work:stop-after',
  resumeWork: 'work:resume-work',
  abandon: 'work:abandon',
  workSettings: 'work:settings',
  config: 'config:get',
  updateConfig: 'config:update',
  selectWork: 'app:select-work',
  focusWork: 'app:focus-work',
  terminalAttach: 'terminal:attach',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalData: (key: string) => `terminal:data:${key}`,
} as const
