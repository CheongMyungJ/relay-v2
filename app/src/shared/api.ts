// preload가 contextBridge로 렌더러에 내보내는 API (I2, I14).
// 렌더러는 명령을 invoke로 보내고, 메인은 상태가 바뀔 때마다 Work 스냅샷을 보낸다.
// 터미널 출력은 task별 채널로 보낸다. 메인과 렌더러가 같은 타입을 보도록 여기에 둔다.
import type { AppConfig, WorkSettingsPatch } from './config'
import type { ProjectSettings } from './project'
import type {
  ActivityUpdate,
  AppSnapshot,
  ApproveOptions,
  CleanInput,
  CleanPreviewResult,
  CommandResult,
  CreateSessionResult,
  CreateWorkResult,
  DeliverInput,
  DeliverResult,
  MergeInfoResult,
  MergeInput,
  NewWorkInput,
  BaseStep,
  CustomTypeFiles,
  CustomTypeList,
  CustomTypeView,
  FileChangesResult,
  FileListResult,
  FileReadResult,
  FileSaveResult,
  FilesOpenTarget,
  TidyView,
  PrItemAction,
  ProjectInspection,
  ProjectRemovePreviewResult,
  ProjectView,
  RespondStartInput,
  ReviewView,
  SubmoduleView,
  NewWorkRepo,
  RepoChoiceView,
  TerminalBacklog,
  SessionView,
  TerminalChunk,
  WorkView,
} from './views'
import type { DeliveryChoice, TypeSource, WorkType } from './work'
import type { HumanAnswers } from './questions'
import type { DraftRef } from './session'

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
  /**
   * 터미널 줄의 경로 낱말마다 시도할 글들 중 처음으로 있는 파일이나 폴더의 번호, 없으면 null (D411). 상대 경로는 그
   * 터미널의 폴더에서 푼다
   */
  paths(key: string, groups: string[][]): Promise<(number | null)[]>
  /**
   * 경로 글의 파일을 연다. 안전한 형식이 아니면 폴더에서 보여 준다 (D411, D412). 주소는 openExternal로 연다.
   * external이 아니고 그 Work worktree 안의 글 파일이면 열지 않고 [파일] 탭에서 열 자리를 돌려준다 (D491)
   */
  open(key: string, path: string, external: boolean): Promise<FilesOpenTarget | null>
  /** 끌어 놓거나 붙여넣은 파일의 경로. 디스크에 없는 것(브라우저의 그림 등)은 빈 글이다 (D410) */
  fileFor(file: File): string
  /** 붙여넣은 그림을 저장하고 경로를 돌려준다 (D410) */
  saveImage(data: ArrayBuffer, mime: string): Promise<string>
}

export interface RelayApi {
  appInfo(): Promise<AppInfo>
  snapshot(): Promise<AppSnapshot>
  onWork(cb: (work: WorkView) => void): () => void
  /** Work 기록을 지웠다 (D407, D408). 받은 키의 Work를 목록에서 뺀다 */
  onWorkRemoved(cb: (workKey: string) => void): () => void
  /** 도구 훅으로 바뀐 진행 표시 (D216). 스냅샷보다 자주 온다 */
  onActivity(cb: (update: ActivityUpdate) => void): () => void
  onProjects(cb: (projects: ProjectView[]) => void): () => void
  /** 기본 세션 목록 (D405) */
  onSessions(cb: (sessions: SessionView[]) => void): () => void
  /** 폴더 선택 창. title은 창의 제목이다. 취소하면 null */
  pickFolder(title: string): Promise<string | null>
  inspectProject(path: string): Promise<ProjectInspection>
  registerProject(path: string, defaultBranch: string): Promise<CommandResult>
  /** [등록 해제] 창을 열 때 (D408): 막는 까닭과 함께 지울 Work 수 */
  projectRemovePreview(projectId: string): Promise<ProjectRemovePreviewResult>
  /** 프로젝트 우클릭 [등록 해제] (D408): Work가 모두 보관됐을 때만. 프로젝트의 기록을 함께 지운다 */
  removeProject(projectId: string): Promise<CommandResult>
  /** 기준 브랜치 목록. 프로젝트의 기본 브랜치가 맨 앞이다 */
  branches(projectId: string): Promise<string[]>
  /**
   * 새 Work 대화상자의 작업 브랜치 이름 (D426): 프로젝트의 규칙에 다음 work-id와 유형, 짧은 이름을 채운 것이다. 끝의 임의의
   * 4자는 넣지 않는다(만들 때 붙인다, D427)
   */
  branchName(projectId: string, type: WorkType, slug: string, customType?: string): Promise<string>
  /** 새 Work 대화상자의 커스텀 유형 (D451, D460): 이 프로젝트의 레포 유형 뒤에 가려지지 않은 전역 유형 */
  customTypes(projectId: string): Promise<CustomTypeView[]>
  /** 업무 유형 화면의 목록 (D459) */
  customTypeList(): Promise<CustomTypeList>
  /** 유형 폴더의 글. 레포 유형은 projectId로 찾고, 기본 유형은 앱의 것이다 (D506). 깨졌거나 없으면 null이다 */
  customTypeFiles(
    source: TypeSource,
    projectId: string | null,
    id: string,
  ): Promise<CustomTypeFiles | null>
  /** 전역 유형을 쓴다 (D459). 이름을 바꿨으면 previousId의 폴더를 지운다. 없는 산출물을 가리키면 경고가 온다 (D513) */
  saveCustomType(
    files: CustomTypeFiles,
    previousId: string | null,
  ): Promise<CommandResult & { warnings?: string[] }>
  deleteCustomType(id: string): Promise<CommandResult>
  /** [레포로 복사] (D450). 커밋은 사람이 한다 */
  copyCustomTypeToRepo(id: string, projectId: string): Promise<CommandResult & { path?: string }>
  /** [폴더 열기] (D459). id가 null이면 그 위치의 유형 폴더 전체다 */
  openCustomTypeFolder(
    source: TypeSource,
    projectId: string | null,
    id: string | null,
  ): Promise<CommandResult>
  /** [새 유형]의 베이스 (D512): 고른 유형의 정의와 칸의 글 모두. 깨졌거나 없으면 null이다 */
  typeBase(
    source: TypeSource,
    projectId: string | null,
    id: string,
  ): Promise<CustomTypeFiles | null>
  /** [단계 더하기]의 기반 단계 (D512): 기본 유형 단계의 정의와 절차. 없으면 null이다 */
  baseStep(type: WorkType, step: string): Promise<BaseStep | null>
  /** 새 Work 대화상자의 대상 목록: 메인 프로젝트의 서브모듈 (D413) */
  submodules(projectId: string): Promise<SubmoduleView[]>
  /** 서브모듈을 대상으로 고른다: 서브모듈 프로젝트를 만들거나 다시 점검한다 (D413) */
  prepareSubmodule(
    projectId: string,
    path: string,
  ): Promise<CommandResult & { project?: ProjectView }>
  /** 새 Work 대화상자의 레포 표: 메인 기준 브랜치의 커밋에 있는 서브모듈 (D472) */
  bundleRepos(
    projectId: string,
    branch: string,
    location: 'local' | 'remote',
  ): Promise<SubmoduleView[]>
  /** 레포 표에서 서브모듈을 고른다: 받지 않았으면 받고 기준 브랜치를 읽는다 (D472) */
  repoChoice(
    projectId: string,
    path: string,
  ): Promise<{ ok: true; view: RepoChoiceView } | { ok: false; error: string }>
  /** [레포 추가] (D473) */
  addRepo(workKey: string, repo: NewWorkRepo): Promise<CommandResult>
  createWork(projectId: string, input: NewWorkInput): Promise<CreateWorkResult>
  /** 기준 브랜치의 지식 정리 후보 (D393) */
  knowledgeTidy(
    projectId: string,
    baseBranch: string,
    location: 'local' | 'remote',
  ): Promise<TidyView>
  review(workKey: string, taskId: string): Promise<ReviewView | null>
  approve(workKey: string, taskId: string, opts: ApproveOptions): Promise<CommandResult>
  /** 승인 화면의 [취소]: 자동 승인 카운트다운을 멈춘다 (4.3) */
  cancelCountdown(workKey: string, taskId: string): Promise<CommandResult>
  /** 독립 리뷰 중에 리뷰 뒤 전할 말을 남긴다 (D529). 빈 글이면 지운다 */
  reviewNote(workKey: string, taskId: string, text: string): Promise<CommandResult>
  /** [직접 맡기] (D523): relay MCP 호출자가 진행하던 Work를 사람이 맡는다 */
  takeOver(workKey: string): Promise<CommandResult>
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
  /** [이 단계 끝나면 멈춤]을 켜거나 끈다 (시나리오 3-4) */
  stopAfter(workKey: string, on: boolean): Promise<CommandResult>
  /** 머지 대상 브랜치를 바꾼다 (D428). PR을 만들기 전에만 받는다 */
  setTarget(workKey: string, branch: string): Promise<CommandResult>
  /** [아카이브로 옮기기]: 보관된 Work를 사이드바의 공통 아카이브로 옮긴다 */
  shelve(workKey: string): Promise<CommandResult>
  /** 멈춘 Work의 [재개] (3.3) */
  resumeWork(workKey: string): Promise<CommandResult>
  /** [Work 포기] (3.3) */
  abandon(workKey: string): Promise<CommandResult>
  /**
   * 우클릭 [기록 지우기] (D407): Work의 기록과 산출물을 지운다. 보관되지 않은 완료·포기 Work는 clean(정리 확인)으로
   * 먼저 정리한다. 보관된 Work는 null이다
   */
  deleteWork(workKey: string, clean: CleanInput | null): Promise<CommandResult>
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
  /** [파일] 탭의 폴더 하나 (D465). rel은 worktree 기준 상대 경로(`/`로 이음)이고 빈 글은 worktree다 */
  workFiles(workKey: string, rel: string): Promise<FileListResult>
  /** [파일] 탭에서 연 파일 (D466). 글이 아니거나 너무 크면 크기만 돌려준다 */
  readWorkFile(workKey: string, rel: string): Promise<FileReadResult>
  /** [파일] 탭 트리의 바뀐 파일 표시 (D490): Work가 기준 커밋 뒤에 더하거나 고치거나 지운 파일 */
  workFileChanges(workKey: string): Promise<FileChangesResult>
  /** [파일] 탭의 [저장] (D467). hash는 열 때 받은 값이고, null이면 연 뒤 바뀐 파일을 덮어쓴다 */
  saveWorkFile(
    workKey: string,
    rel: string,
    text: string,
    hash: string | null,
  ): Promise<FileSaveResult>
  /** [새 세션] 창의 폴더 기본값 (D398) */
  defaultSessionDir(): Promise<string>
  /** [새 세션]의 [만들기] (시나리오 12-1). 만들고 바로 띄운다 */
  createSession(cwd: string): Promise<CreateSessionResult>
  /** 기본 세션의 [열기]·[새 대화로 열기] (시나리오 12-6) */
  openSession(id: string, fresh: boolean): Promise<CommandResult>
  /** 기본 세션의 [닫기] */
  closeSession(id: string): Promise<CommandResult>
  /** 기본 세션의 [이름 바꾸기] (D403) */
  renameSession(id: string, name: string): Promise<CommandResult>
  /** 기본 세션의 [지우기] (D402): 끝난 세션만 */
  deleteSession(id: string): Promise<CommandResult>
  /** 초안 카드의 [버리기] (D404, D421) */
  discardDraft(ref: DraftRef): Promise<CommandResult>
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
  prRefresh(workKey: string, repo?: string): Promise<CommandResult>
  /** PR 패널의 [제외], [다시 넣기], [받기] (D160, D161, D170) */
  prItem(
    workKey: string,
    itemId: string,
    action: PrItemAction,
    repo?: string,
  ): Promise<CommandResult>
  /** 머지 창을 열 때: 레포가 허용하는 방식과 기본 선택, 머지할 head (D176, D177) */
  prMergeInfo(workKey: string, repo?: string): Promise<MergeInfoResult>
  /** 머지 창의 [머지] (D176). 창에 보인 head가 아니면 머지하지 않는다 */
  prMerge(workKey: string, input: MergeInput): Promise<CommandResult>
  /** [머지 없이 끝내기] (D179). GitHub의 PR은 건드리지 않는다 */
  prEnd(workKey: string, repo?: string): Promise<CommandResult>
  /** 머지 뒤 정리 창을 열었다 (D178, D200). 다시 열지 않는다 */
  prCleanOffered(workKey: string, repo?: string): Promise<CommandResult>
  /** PR 패널의 [대응 시작] (시나리오 10-3, D170, D182). 사람이 본 새 항목과 사람 지시를 보낸다 */
  prRespond(workKey: string, input: RespondStartInput): Promise<CommandResult>
  /** 메인 PR 카드의 [서브모듈 커밋 맞추기] (D481) */
  prRelink(workKey: string): Promise<CommandResult>
  /** PR 패널의 [실패한 체크 다시 실행] (D175, D203) */
  prRerun(workKey: string, repo?: string): Promise<CommandResult>
  /** 이슈 기록의 [다시 시도] (설계 3.7, D344) */
  issueRetry(workKey: string): Promise<CommandResult>
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
  workRemoved: 'app:work-removed',
  activity: 'app:activity',
  projects: 'app:projects',
  sessions: 'app:sessions',
  pickFolder: 'project:pick-folder',
  inspectProject: 'project:inspect',
  registerProject: 'project:register',
  removeProject: 'project:remove',
  projectRemovePreview: 'project:remove-preview',
  branches: 'project:branches',
  branchName: 'project:branch-name',
  customTypes: 'types:for-project',
  customTypeList: 'types:list',
  customTypeFiles: 'types:files',
  saveCustomType: 'types:save',
  deleteCustomType: 'types:delete',
  copyCustomTypeToRepo: 'types:copy-to-repo',
  openCustomTypeFolder: 'types:open-folder',
  typeBase: 'types:base',
  baseStep: 'types:base-step',
  submodules: 'project:submodules',
  prepareSubmodule: 'project:prepare-submodule',
  bundleRepos: 'project:bundle-repos',
  repoChoice: 'project:repo-choice',
  addRepo: 'work:add-repo',
  createWork: 'work:create',
  knowledgeTidy: 'work:knowledge-tidy',
  review: 'work:review',
  approve: 'work:approve',
  cancelCountdown: 'work:cancel-countdown',
  reviewNote: 'work:review-note',
  takeOver: 'work:take-over',
  answerQuestion: 'work:answer-question',
  interrupt: 'work:interrupt',
  resume: 'work:resume',
  stopAfter: 'work:stop-after',
  setTarget: 'work:set-target',
  shelve: 'work:shelve',
  resumeWork: 'work:resume-work',
  abandon: 'work:abandon',
  deleteWork: 'work:delete',
  deliver: 'work:deliver',
  openCleanup: 'work:open-cleanup',
  closeCleanup: 'work:close-cleanup',
  openSide: 'work:open-side',
  closeSide: 'work:close-side',
  finishCleanup: 'work:finish-cleanup',
  workFiles: 'files:list',
  readWorkFile: 'files:read',
  saveWorkFile: 'files:save',
  workFileChanges: 'files:changes',
  defaultSessionDir: 'session:default-dir',
  createSession: 'session:create',
  openSession: 'session:open',
  closeSession: 'session:close',
  renameSession: 'session:rename',
  deleteSession: 'session:delete',
  discardDraft: 'session:discard-draft',
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
  prRelink: 'pr:relink',
  issueRetry: 'issue:retry',
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
  terminalPaths: 'terminal:paths',
  terminalOpen: 'terminal:open',
  terminalSaveImage: 'terminal:save-image',
  terminalData: (key: string) => `terminal:data:${key}`,
} as const
