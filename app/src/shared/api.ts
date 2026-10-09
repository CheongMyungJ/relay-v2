// preload가 contextBridge로 렌더러에 내보내는 API (I2, I14).
// 렌더러는 명령을 invoke로 보내고, 메인은 상태가 바뀔 때마다 Work 스냅샷을 보낸다.
// 터미널 출력은 task별 채널로 보낸다. 메인과 렌더러가 같은 타입을 보도록 여기에 둔다.
import type { AppConfig, WorkSettingsPatch } from './config'
import type { NodeName } from './contracts'
import type { ProjectSettings } from './project'
import type {
  ActivityUpdate,
  AppSnapshot,
  ApproveOptions,
  CleanInput,
  CleanPreviewResult,
  CommandResult,
  CreateWorkResult,
  DeliverInput,
  DeliverResult,
  MergeInfoResult,
  MergeInput,
  NewWorkInput,
  PrItemAction,
  ProjectInspection,
  ProjectView,
  RespondStartInput,
  ReviewView,
  SelectStepInput,
  StepPreviewResult,
  TerminalBacklog,
  TerminalChunk,
  WorkView,
} from './views'
import type { DeliveryChoice, WorkType } from './work'
import type { HumanAnswers } from './questions'

export interface AppInfo {
  platform: string
  /** Windows 빌드 번호. xterm의 windowsPty에 넘긴다. Windows가 아니면 null */
  windowsBuild: number | null
  /** 실행 중인 앱의 버전 (app.getVersion). 사이드바의 relay 옆에 보인다 */
  version: string
}

/**
 * 앱 업데이트의 지금 상태 (I121). 사이드바의 업데이트 버튼이 보인다.
 * off: 이 설치본은 앱이 업데이트하지 않음(개발 앱, macOS, 0.0.0 빌드 등, I95). manual: 받았지만 사람이 설치해야 함(D379)
 */
export type UpdateState =
  | { kind: 'off' }
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest' }
  | { kind: 'downloading'; version: string; percent: number | null }
  | { kind: 'ready'; version: string }
  | { kind: 'manual'; version: string }
  | { kind: 'error'; message: string }

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
  /** 도구 훅으로 바뀐 진행 표시 (D216). 스냅샷보다 자주 온다 */
  onActivity(cb: (update: ActivityUpdate) => void): () => void
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
  /** 승인 화면의 [취소]: 자동 승인 카운트다운을 멈춘다 (4.3) */
  cancelCountdown(workKey: string, taskId: string): Promise<CommandResult>
  /** Codex MCP 질문의 실제 답변. null은 취소이며 선택이나 동의로 취급하지 않는다. */
  answerQuestion(
    workKey: string,
    taskId: string,
    questionId: string,
    answers: HumanAnswers | null,
  ): Promise<CommandResult>
  /** [즉시 중단] (시나리오 3-4) */
  interrupt(workKey: string, taskId: string): Promise<CommandResult>
  /** [재개], [세션 재개] (시나리오 3-4, 3-5, 4.4) */
  resume(workKey: string, taskId: string): Promise<CommandResult>
  /** [이 단계 새 세션으로 다시] (시나리오 3-5, D114) */
  retry(workKey: string, taskId: string): Promise<CommandResult>
  /** [이 단계 끝나면 멈춤]을 켜거나 끈다 (시나리오 3-4) */
  stopAfter(workKey: string, on: boolean): Promise<CommandResult>
  /** [아카이브로 옮기기]: 보관된 Work를 사이드바의 공통 아카이브로 옮긴다 */
  shelve(workKey: string): Promise<CommandResult>
  /** 멈춘 Work의 [재개] (3.3) */
  resumeWork(workKey: string): Promise<CommandResult>
  /** [Work 포기] (3.3) */
  abandon(workKey: string): Promise<CommandResult>
  /** 단계 선택 대화상자의 미리 보기 (6.2, D82). type은 의도 승인 전 [intake 다시]에서 고른 유형이다 (D237) */
  stepPreview(
    workKey: string,
    node: NodeName,
    keepCode: boolean,
    type?: WorkType,
  ): Promise<StepPreviewResult>
  /** [단계 선택]의 [확인] (6.2) */
  selectStep(workKey: string, input: SelectStepInput): Promise<CommandResult>
  /** [push]·[PR 생성] (시나리오 7-4~7-6). 커밋 안 된 변경이 있으면 목록을 돌려준다 (7-5) */
  deliver(workKey: string, input: DeliverInput): Promise<DeliverResult>
  /** [AI 세션 열기] (7-5) */
  openCleanup(workKey: string, choice: DeliveryChoice): Promise<CommandResult>
  /** [정리 세션 닫기] (D137): 정리 세션을 끝내고 전달하지 않는다 */
  closeCleanup(workKey: string): Promise<CommandResult>
  /** [곁 세션 열기] (시나리오 11). fresh면 앞 대화를 잇지 않고 새 대화로 연다 */
  openSide(workKey: string, fresh: boolean): Promise<CommandResult>
  /** [곁 세션 닫기] */
  closeSide(workKey: string): Promise<CommandResult>
  /** [정리 끝 → push/PR 진행] (7-5) */
  finishCleanup(workKey: string): Promise<DeliverResult>
  /** Work 완료 화면의 [다시 점검]: origin과 gh를 다시 점검한다 (D118) */
  recheck(workKey: string): Promise<CommandResult>
  /** [Work 정리]의 확인 요약 (시나리오 8-1) */
  cleanPreview(workKey: string): Promise<CleanPreviewResult>
  /** [Work 정리]의 [정리] (시나리오 8-2) */
  clean(workKey: string, input: CleanInput): Promise<CommandResult>
  /** 끊긴 작업의 [다시 시도] (시나리오 9-4, D123). 끊긴 전달은 커밋 안 된 변경이 남았으면 목록을 돌려준다 */
  retryOperation(workKey: string): Promise<DeliverResult>
  /** 끊긴 작업의 [무시] (D123) */
  ignoreOperation(workKey: string): Promise<CommandResult>
  /** 재시작 때와 실행 중의 알림의 [확인] (D121, D124) */
  dismissNotice(workKey: string, id: string): Promise<CommandResult>
  /** 비교 URL이나 PR 주소를 브라우저에서 연다 (7-4). http(s) 주소만 연다 */
  openExternal(url: string): Promise<void>
  /** PR 패널의 [새로 고침] (D158). 닫힌 PR도 읽는다 (D179) */
  prRefresh(workKey: string): Promise<CommandResult>
  /** PR 패널의 [제외], [다시 넣기], [받기] (D160, D161, D170) */
  prItem(workKey: string, itemId: string, action: PrItemAction): Promise<CommandResult>
  /** 머지 창을 열 때: 레포가 허용하는 방식과 기본 선택, 머지할 head (D176, D177) */
  prMergeInfo(workKey: string): Promise<MergeInfoResult>
  /** 머지 창의 [머지] (D176). 창에 보인 head가 아니면 머지하지 않는다 */
  prMerge(workKey: string, input: MergeInput): Promise<CommandResult>
  /** [머지 없이 끝내기] (D179). GitHub의 PR은 건드리지 않는다 */
  prEnd(workKey: string): Promise<CommandResult>
  /** 머지 뒤 정리 창을 열었다 (D178, D200). 다시 열지 않는다 */
  prCleanOffered(workKey: string): Promise<CommandResult>
  /** PR 패널의 [대응 시작] (시나리오 10-3, D170, D182). 사람이 본 새 항목과 사람 지시를 보낸다 */
  prRespond(workKey: string, input: RespondStartInput): Promise<CommandResult>
  /** PR 패널의 [실패한 체크 다시 실행] (D175, D203) */
  prRerun(workKey: string): Promise<CommandResult>
  /** 이슈 기록의 [다시 시도] (설계 3.7, D344) */
  issueRetry(workKey: string): Promise<CommandResult>
  /** 요구사항 추출의 사람 결정 필요에 답한다 (requirements-extraction-flow.md 결정 7, 41) */
  answerRequirements(
    workKey: string,
    answers: { decision: string; answer: string }[],
  ): Promise<CommandResult>
  /** run 상한으로 멈춘 요구사항 추출의 [계속 +N]: 상한을 늘리고 이어서 돈다 (결정 26, 99) */
  extendRequirements(workKey: string, runs: number): Promise<CommandResult>
  /** 프로젝트 설정 (5.1.2, D185): 받을 봇과 기본 머지 방식, 이슈 기록(D337) */
  updateProjectSettings(projectId: string, settings: ProjectSettings): Promise<CommandResult>
  /** Work별 자동 승인과 질문 방식 (D72). 준 키만 바꾸고, 빈 값이면 앱 설정을 따른다 */
  updateWorkSettings(workKey: string, settings: WorkSettingsPatch): Promise<CommandResult>
  /** 앱 설정 (D70) */
  config(): Promise<AppConfig>
  /** 설정 화면에서 바꾼 값. 바로 적용한다 (D73) */
  updateConfig(patch: Partial<AppConfig>): Promise<CommandResult>
  /** 사람이 보고 있는 Work. 그 Work의 알림은 보내지 않는다 (D81) */
  selectWork(workKey: string | null): void
  /** 알림을 누르면 그 Work를 고르게 한다 */
  onFocusWork(cb: (workKey: string) => void): () => void
  /** 앱 업데이트의 지금 상태 (I121) */
  updateState(): Promise<UpdateState>
  /** 앱 업데이트 상태가 바뀌면 */
  onUpdate(cb: (state: UpdateState) => void): () => void
  /** 업데이트 버튼: 새 버전을 지금 확인하고 있으면 받는다. 확인·받는 중이거나 받아 두었으면 하지 않는다 */
  checkUpdate(): Promise<void>
  /**
   * 받아 둔 버전을 설치한다. 사람이 확인한 뒤에만 부른다. 앱을 끝내고(세션 종료 확인과 정리 뒤) 설치하고 다시 켠다.
   * 사람이 설치해야 하는 곳(manual)에서는 설치 명령 대화상자를 보인다(D379)
   */
  installUpdate(): Promise<void>
  terminal: TerminalApi
}

export const API_KEY = 'relay'

// IPC 채널. 터미널 출력은 task별 채널로 보낸다 (I14).
export const IPC = {
  appInfo: 'app:info',
  snapshot: 'app:snapshot',
  work: 'app:work',
  activity: 'app:activity',
  projects: 'app:projects',
  pickFolder: 'project:pick-folder',
  inspectProject: 'project:inspect',
  registerProject: 'project:register',
  branches: 'project:branches',
  createWork: 'work:create',
  review: 'work:review',
  approve: 'work:approve',
  cancelCountdown: 'work:cancel-countdown',
  answerQuestion: 'work:answer-question',
  interrupt: 'work:interrupt',
  resume: 'work:resume',
  retry: 'work:retry',
  stopAfter: 'work:stop-after',
  shelve: 'work:shelve',
  resumeWork: 'work:resume-work',
  abandon: 'work:abandon',
  stepPreview: 'work:step-preview',
  selectStep: 'work:select-step',
  deliver: 'work:deliver',
  openCleanup: 'work:open-cleanup',
  closeCleanup: 'work:close-cleanup',
  openSide: 'work:open-side',
  closeSide: 'work:close-side',
  finishCleanup: 'work:finish-cleanup',
  recheck: 'work:recheck',
  cleanPreview: 'work:clean-preview',
  clean: 'work:clean',
  retryOperation: 'work:retry-operation',
  ignoreOperation: 'work:ignore-operation',
  dismissNotice: 'work:dismiss-notice',
  openExternal: 'app:open-external',
  prRefresh: 'pr:refresh',
  prItem: 'pr:item',
  prMergeInfo: 'pr:merge-info',
  prMerge: 'pr:merge',
  prEnd: 'pr:end',
  prCleanOffered: 'pr:clean-offered',
  prRespond: 'pr:respond',
  prRerun: 'pr:rerun',
  issueRetry: 'issue:retry',
  answerRequirements: 'requirements:answer',
  extendRequirements: 'requirements:extend',
  projectSettings: 'project:settings',
  workSettings: 'work:settings',
  config: 'config:get',
  updateConfig: 'config:update',
  selectWork: 'app:select-work',
  focusWork: 'app:focus-work',
  updateState: 'update:state',
  update: 'update:changed',
  checkUpdate: 'update:check',
  installUpdate: 'update:install',
  terminalAttach: 'terminal:attach',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalData: (key: string) => `terminal:data:${key}`,
} as const
