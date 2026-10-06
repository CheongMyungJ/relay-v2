// 앱의 조립 (I26). 저장소를 읽고, 훅 서버를 띄우고, 프로젝트 등록(시나리오 0)과 Work 생성(시나리오 1),
// 재시작 때의 고아 프로세스 종료와 조정(시나리오 9), 세션 상한과 대기열(D18), 앱 설정(D70)을 맡는다.
// Work 하나의 흐름은 WorkRunner가 맡는다.
// Electron을 import하지 않으므로 흐름 시험이 Vitest(Node)에서 이 코드를 그대로 불러 쓴다.
// 창과 알림, 렌더러로 보내기는 UiPort로 받는다.
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import {
  addWorktree,
  branches as gitBranches,
  commitOf,
  fetchBranch,
  hasRemote,
} from '../adapters/git'
import { HookServer } from '../adapters/hooks'
import { killOrphans } from '../adapters/pty'
import {
  WorkFiles,
  loadConfig,
  loadProjects,
  saveConfig,
  saveProject,
  workDir,
  workIds,
  worktreeDir,
} from '../adapters/store'
import { applyConfigPatch, checkProjectSettings, checkWorkSettings } from '../core/config'
import { createWork } from '../core/machine'
import { NODE_INFO } from '../core/pipeline'
import { issueMarkId } from '../core/issue'
import { localIso, nextWorkId, workBranch } from '../core/records'
import { recordedProcesses, type RecordedProcess } from '../core/recovery'
import { resolveAgent } from '../shared/agent'
import { DEFAULT_CONFIG, type AppConfig, type WorkSettingsPatch } from '../shared/config'
import type { NodeName } from '../shared/contracts'
import { issueLogOn, type ProjectChecks, type ProjectState } from '../shared/project'
import type {
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
} from '../shared/views'
import { WORK_TYPES, type DeliveryChoice, type WorkState, type WorkType } from '../shared/work'
import { SessionPool } from './pool'
import type { UiPort } from './ports'
import { checkGh, inspectProject, prepareProject, type ProjectEnv } from './projects'
import { WorkRunner, workTitle, type RunnerContext } from './work'

export interface RelayOptions {
  /** RELAY_HOME (D74) */
  home: string
  /** 스킬 원본 폴더 (D103). RELAY_SKILLS_DIR나 앱에 묶은 skills/ */
  skills: string
  ui: UiPort
  /** claude 찾기(CLAUDE_BIN, D106), git, PTY에 쓰는 환경 변수. 기본은 process.env */
  env?: NodeJS.ProcessEnv
  /** gh 실행 파일. 기본은 PATH의 gh */
  ghBin?: string
  now?: () => Date
  /** 앱 설정을 읽었거나 바꿨다. 테마(D335)처럼 Electron이 적용할 것을 main이 적용한다 */
  onConfig?: (config: AppConfig) => void
}

const RELAY_BRANCH = 'relay/'

export class Relay {
  private readonly projects = new Map<string, ProjectState>()
  private readonly works = new Map<string, WorkRunner>()
  private readonly hooks = new HookServer()
  private readonly env: NodeJS.ProcessEnv
  private config: AppConfig = DEFAULT_CONFIG
  /** 살아 있는 세션의 합계 상한과 대기열 (D18). 상한은 판정하는 때의 설정을 쓴다 (D73) */
  private readonly pool = new SessionPool(() => this.config.session_limit)
  private readonly warnings: string[] = []
  private size = { cols: 120, rows: 32 }
  private creating = false
  /** 설정 바꾸기를 차례로 한다. 겹친 두 바꾸기가 서로의 값을 지우지 않게 */
  private configQueue: Promise<unknown> = Promise.resolve()
  /** project.json 고치기의 차례 (updateProject) */
  private projectWrites: Promise<unknown> = Promise.resolve()

  private constructor(private readonly o: RelayOptions) {
    this.env = o.env ?? process.env
  }

  /**
   * 저장소를 읽고 훅 서버를 띄우고 재시작 조정을 한다 (시나리오 9): 고아 프로세스를 끝내고(D76, D126), Work마다
   * 실행 중이던 task와 대기열을 맞추고(D75, D78), 끊긴 작업(D77, D121)과 바뀐 앱 소유 파일(D124)을 알린다.
   */
  static async open(o: RelayOptions): Promise<Relay> {
    const relay = new Relay(o)
    await relay.load()
    return relay
  }

  private async load(): Promise<void> {
    const { config, warning } = await loadConfig(this.o.home)
    this.config = config
    this.o.onConfig?.(config)
    if (warning) this.warnings.push(warning)
    await this.hooks.listen()
    const loaded: WorkRunner[] = []
    for (const project of await loadProjects(this.o.home, this.warnings)) {
      this.projects.set(project.project_id, project)
      for (const id of await workIds(this.o.home, project.project_id)) {
        const files = new WorkFiles(workDir(this.o.home, project.project_id, id))
        try {
          // 읽은 내용은 다음에 work.json을 쓰기 전에 비교한다 (D124)
          const read = await files.readWork()
          if (!read) continue
          const title = workTitle(await files.readRequest())
          const runner = this.runner(project, files, read.work, title, read.text)
          this.works.set(runner.key, runner)
          loaded.push(runner)
        } catch (e) {
          this.warnings.push(`${project.project_id}/${id}: work.json을 읽을 수 없음 (${String(e)})`)
        }
      }
    }
    // 1. 고아 프로세스 (시나리오 9-1): 모든 Work의 기록을 모아 한 번에 확인하고 끝낸다
    const killed = await this.killOrphans(loaded)
    // 2~6. 재시작 조정. Work마다 따로라 함께 한다. 조정하지 못한 Work만 빼고 앱을 연다 (D332)
    const failed = new Set<WorkRunner>()
    await Promise.all(
      loaded.map((r) =>
        r.reconcile(killed.get(r) ?? []).catch(async (e: unknown) => {
          failed.add(r)
          this.works.delete(r.key)
          this.warnings.push(
            `${r.key}: 재시작 조정에서 기록을 쓰지 못해 이 Work를 열지 않음. 원인을 치운 뒤 앱을 다시 켜세요 (${String(e)})`,
          )
          await r.shutdown().catch(() => undefined)
        }),
      ),
    )
    // 이슈 기록에 남은 게시를 앞부터 잇는다 (I98, D344). 기다리지 않는다
    for (const r of loaded) if (!failed.has(r)) r.publishIssueSoon()
    // PR 진행인 Work는 항목을 읽어 두고 PR을 한 번 읽는다 (D159). 읽은 결과로 알리지 않는다
    await Promise.all(
      loaded
        .filter((r) => !failed.has(r))
        .map((r) =>
          r.startPr({ quiet: true }).catch((e: unknown) => {
            this.warnings.push(`${r.key}: PR 진행을 시작하지 못함 (${String(e)})`)
          }),
        ),
    )
  }

  /**
   * 기록한 claude 프로세스(task의 세션과 살아 있던 정리 세션) 가운데 ID와 시작 시각이 같은 것이 살아 있으면 트리째
   * 끝낸다 (시나리오 9-1, D76, D126). 시작 시각이 다르면 건드리지 않는다. Work마다 끝낸 기록을 돌려준다
   */
  private async killOrphans(
    runners: readonly WorkRunner[],
  ): Promise<Map<WorkRunner, RecordedProcess[]>> {
    const records = runners.flatMap((r) => recordedProcesses(r.work).map((p) => ({ r, p })))
    const out = new Map<WorkRunner, RecordedProcess[]>()
    if (records.length === 0) return out
    let killed: { pid: number; startedAt: string }[]
    try {
      killed = await killOrphans(records.map(({ p }) => ({ pid: p.pid, startedAt: p.startedAt })))
    } catch (e) {
      this.warnings.push(`남아 있던 프로세스를 확인하지 못함 (${String(e)})`)
      return out
    }
    for (const { r, p } of records) {
      if (killed.some((k) => k.pid === p.pid && k.startedAt === p.startedAt)) {
        out.set(r, [...(out.get(r) ?? []), p])
      }
    }
    return out
  }

  /**
   * 앱을 끝낸다 (시나리오 3-6). 대기열에서 더 시작하지 않고, 살아 있는 세션은 중단됨으로 남기고 트리째 끝낸다.
   * 확인 창은 Electron 쪽(main/index)이 띄운다.
   */
  async close(): Promise<void> {
    this.pool.close()
    await Promise.all([...this.works.values()].map((w) => w.shutdown()))
    await this.hooks.close()
  }

  /** 하던 PR 읽기가 모두 끝나기를 기다린다 (WorkRunner.prIdle). 시험 도구가 close 뒤에 부른다 */
  async settled(): Promise<void> {
    await Promise.all([...this.works.values()].map((w) => Promise.all([w.prIdle(), w.issueIdle()])))
  }

  /** 이 앱에서 살아 있는 세션이 있다. 앱을 끝낼 때 확인 창을 띄운다 (시나리오 3-6) */
  hasLiveSessions(): boolean {
    return [...this.works.values()].some((w) => w.hasLiveSession())
  }

  private context(): RunnerContext {
    return {
      env: this.env,
      skills: this.o.skills,
      hooks: this.hooks,
      ui: this.o.ui,
      pool: this.pool,
      config: () => this.config,
      at: () => this.at(),
      size: () => this.size,
      ghBin: this.ghBin(),
      checks: (projectId) => this.projects.get(projectId)?.checks,
      project: (projectId) => this.projects.get(projectId),
      recheck: (projectId) => this.recheck(projectId),
      knowledgeSources: (projectId, except) =>
        [...this.works.values()]
          .filter(
            (w) =>
              w.project.project_id === projectId &&
              w.work.work_id !== except &&
              // PR이 머지된 Work는 그 지식이 기준 브랜치에 있다(squash·rebase 포함). 브랜치를 남겨 둬도 넣지 않는다
              w.work.pr?.merged === undefined &&
              (w.work.status === 'pr' ||
                (w.work.completed_at !== undefined && w.work.abandoned_at === undefined)),
          )
          .sort((a, b) =>
            (a.work.completed_at ?? a.work.created_at).localeCompare(
              b.work.completed_at ?? b.work.created_at,
            ),
          )
          .map((w) => ({
            workId: w.work.work_id,
            branch: `${RELAY_BRANCH}${w.work.work_id}`,
            baseCommit: w.work.base_commit,
          })),
    }
  }

  private ghBin(): string {
    return this.o.ghBin ?? 'gh'
  }

  /**
   * 프로젝트의 origin 원격과 gh auth status, gh 버전을 다시 점검해 project.json을 고친다 (D67, D118, D198).
   * verify task를 시작할 때와 Work 완료 화면의 [다시 점검]에서 부른다. 그 프로젝트의 Work 스냅샷을 다시 보낸다.
   */
  private async recheck(projectId: string): Promise<void> {
    const project = this.projects.get(projectId)
    if (!project) return
    const env = this.env
    const gh = (await checkGh(this.ghBin(), env)).check
    const checks: ProjectChecks = {
      origin: await hasRemote(project.repo_path, 'origin', { env }),
      gh: gh.auth,
      gh_version: gh.version,
      checked_at: this.at(),
    }
    await this.updateProject(projectId, (p) => ({ ...p, checks }))
  }

  /**
   * 등록한 프로젝트의 project.json을 고친다. 고치기는 차례로 하고 그때의 최신 상태에서 바꾼다: 다시 점검과 설정 저장이
   * 겹쳐도 한쪽이 다른 쪽을 덮지 않는다. 설정 줄(configQueue)과 따로라 Work의 처리 줄과 서로 기다리지 않는다
   */
  private updateProject(
    projectId: string,
    change: (p: ProjectState) => ProjectState,
  ): Promise<void> {
    const run = this.projectWrites.then(async () => {
      const current = this.projects.get(projectId)
      if (current) await this.saveProjectState(change(current))
    })
    this.projectWrites = run.catch(() => undefined)
    return run
  }

  /** project.json을 쓰고 화면과 그 프로젝트의 Work에 알린다 */
  private async saveProjectState(next: ProjectState): Promise<void> {
    await saveProject(this.o.home, next)
    this.projects.set(next.project_id, next)
    this.o.ui.projects(this.projectViews())
    for (const w of this.works.values()) if (w.project.project_id === next.project_id) w.touch()
  }

  private runner(
    project: ProjectState,
    files: WorkFiles,
    work: WorkState,
    title: string,
    text: string | null = null,
  ): WorkRunner {
    const tree = worktreeDir(this.o.home, project.project_id, work.work_id)
    return new WorkRunner(this.context(), project, files, tree, work, title, text)
  }

  private at(): string {
    return localIso(this.o.now ? this.o.now() : new Date())
  }

  // ---------- 스냅샷 (I14) ----------

  snapshot(): AppSnapshot {
    return {
      projects: this.projectViews(),
      works: [...this.works.values()].map((w) => w.view()),
      warnings: [...this.warnings],
    }
  }

  private projectViews(): ProjectView[] {
    return [...this.projects.values()].map((p) => ({
      id: p.project_id,
      name: path.basename(p.repo_path),
      repoPath: p.repo_path,
      defaultBranch: p.default_branch,
      origin: p.checks.origin,
      gh: p.checks.gh,
      ghVersion: p.checks.gh_version ?? null,
      allowedBots: p.allowed_bots ?? [],
      mergeMethod: p.merge_method ?? null,
      issueLog: issueLogOn(p),
    }))
  }

  work(key: string): WorkRunner | undefined {
    return this.works.get(key)
  }

  // ---------- 앱 설정 (D70, D73) ----------

  /** 지금 앱 설정 */
  currentConfig(): AppConfig {
    return this.config
  }

  /**
   * 설정 화면에서 바꾼 값을 적용한다 (D70). 바로 적용하고, 질문 방식만 다음에 시작하는 task부터 쓴다 (D73).
   * 세션 상한을 올리면 대기열의 task를 바로 시작한다. 카운트다운 중에 그 단계의 자동 승인을 끄면 바로 멈춘다 (D128).
   * 자동 승인을 켜도 이미 승인 대기인 task는 카운트다운하지 않는다: 턴이 끝날 때 판정한다
   */
  updateConfig(patch: unknown): Promise<CommandResult & { config?: AppConfig }> {
    const run = this.configQueue.then(async (): Promise<CommandResult & { config?: AppConfig }> => {
      const r = applyConfigPatch(this.config, patch)
      if (!r.ok) return { ok: false, error: r.error }
      await saveConfig(this.o.home, r.value)
      this.config = r.value
      this.o.onConfig?.(r.value)
      this.pool.fill()
      for (const w of this.works.values()) void w.configChanged()
      return { ok: true, config: r.value }
    })
    this.configQueue = run.catch(() => undefined)
    return run
  }

  // ---------- 프로젝트 등록 (시나리오 0) ----------

  private projectEnv(): ProjectEnv {
    return {
      env: this.env,
      engine: this.config.agent_engine,
      ghBin: this.ghBin(),
      registered: [...this.projects.values()],
    }
  }

  inspectProject(dir: string): Promise<ProjectInspection> {
    return inspectProject(dir, this.projectEnv())
  }

  async registerProject(
    dir: string,
    defaultBranch: string,
  ): Promise<CommandResult & { projectId?: string }> {
    const r = await prepareProject(dir, defaultBranch, this.at(), this.projectEnv())
    if (!r.ok) return r
    await saveProject(this.o.home, r.project)
    this.projects.set(r.project.project_id, r.project)
    this.o.ui.projects(this.projectViews())
    return { ok: true, projectId: r.project.project_id }
  }

  /**
   * 프로젝트 설정 화면의 [저장] (5.1.2, D185): 받을 봇과 기본 머지 방식, 이슈 기록(D337. 다음에 만드는 Work부터, I96). 받을 봇이 바뀌면 PR 진행인 Work의 항목에
   * 거르기 규칙을 다시 적용한다 (D161)
   */
  updateProjectSettings(projectId: string, settings: unknown): Promise<CommandResult> {
    const run = this.configQueue.then(async (): Promise<CommandResult> => {
      const project = this.projects.get(projectId)
      if (!project) return { ok: false, error: '프로젝트가 없습니다' }
      const r = checkProjectSettings(settings)
      if (!r.ok) return { ok: false, error: r.error }
      await this.updateProject(projectId, (p) => ({
        ...p,
        allowed_bots: r.value.allowed_bots,
        merge_method: r.value.merge_method,
        ...(r.value.issue_log === undefined ? {} : { issue_log: r.value.issue_log }),
      }))
      await Promise.all(
        [...this.works.values()]
          .filter((w) => w.project.project_id === projectId)
          .map((w) => w.projectSettingsChanged()),
      )
      return { ok: true }
    })
    this.configQueue = run.catch(() => undefined)
    return run
  }

  /** 기준 브랜치 목록 (시나리오 1). 프로젝트의 기본 브랜치를 맨 앞에 둔다 */
  async branches(projectId: string): Promise<string[]> {
    const project = this.projects.get(projectId)
    if (!project) return []
    const { local, remote } = await gitBranches(project.repo_path, { env: this.env })
    const names = [...new Set([...local, ...remote])].filter((b) => !b.startsWith(RELAY_BRANCH))
    const rest = names.filter((b) => b !== project.default_branch).sort()
    return [project.default_branch, ...rest]
  }

  // ---------- Work 생성 (시나리오 1) ----------

  /**
   * work-id, relay/<work-id> 브랜치와 worktree, 기준 커밋(D97), request.md, work.json을 만들고
   * intake task를 시작한다. 기준 위치가 원격이면 fetch한 origin/<브랜치>에서 분기하고,
   * fetch가 실패하면 Work를 만들지 않는다. 세션 상한을 넘으면 intake는 대기열에서 기다린다 (D18).
   * Work별 자동 승인과 질문 방식을 받으면 work.json에 둔다 (D72). 고른 업무 유형을 work.json에 적는다 (D236).
   */
  async createWork(projectId: string, input: NewWorkInput): Promise<CreateWorkResult> {
    const project = this.projects.get(projectId)
    if (!project) return { ok: false, error: '프로젝트가 없습니다' }
    // work-id를 겹치지 않게 정하려고 한 번에 하나씩 만든다
    if (this.creating) return { ok: false, error: '다른 Work를 만드는 중입니다' }
    if (!input.request.trim()) return { ok: false, error: '요청을 입력하세요' }
    if (!WORK_TYPES.includes(input.type)) return { ok: false, error: '업무 유형을 고르세요' }
    const issue = input.issueNumber ?? null
    if (issue !== null && (!Number.isInteger(issue) || issue <= 0)) {
      return { ok: false, error: '이슈 번호는 1 이상의 정수여야 합니다' }
    }
    const branch = input.baseBranch.trim()
    if (!branch) return { ok: false, error: '기준 브랜치를 고르세요' }
    const settings = checkWorkSettings(input.settings ?? {})
    if (!settings.ok) return { ok: false, error: settings.error }
    this.creating = true
    try {
      return await this.create(project, input, branch, settings.value)
    } finally {
      this.creating = false
    }
  }

  private async create(
    project: ProjectState,
    input: NewWorkInput,
    branch: string,
    settings: WorkSettingsPatch,
  ): Promise<CreateWorkResult> {
    const repo = project.repo_path
    const env = this.env
    let ref = branch
    if (input.baseLocation === 'remote') {
      if (!(await hasRemote(repo, 'origin', { env }))) {
        return { ok: false, error: 'origin 원격이 없어 원격 기준으로 만들 수 없습니다' }
      }
      try {
        await fetchBranch(repo, branch, 'origin', { env })
      } catch (e) {
        return { ok: false, error: `git fetch가 실패해 Work를 만들지 않았습니다. ${String(e)}` }
      }
      ref = `origin/${branch}`
    }
    let baseCommit: string
    try {
      baseCommit = await commitOf(repo, ref, { env })
    } catch {
      return { ok: false, error: `기준 브랜치를 찾을 수 없습니다: ${ref}` }
    }

    const at = this.at()
    const relayBranches = (await gitBranches(repo, { env })).local
      .filter((b) => b.startsWith(RELAY_BRANCH))
      .map((b) => b.slice(RELAY_BRANCH.length))
    const workId = nextWorkId(at, [
      ...(await workIds(this.o.home, project.project_id)),
      ...relayBranches,
    ])
    const tree = worktreeDir(this.o.home, project.project_id, workId)
    try {
      await addWorktree(repo, tree, workBranch(workId), baseCommit, { env })
    } catch (e) {
      return { ok: false, error: `worktree를 만들지 못했습니다. ${String(e)}` }
    }

    const files = new WorkFiles(workDir(this.o.home, project.project_id, workId))
    const requestHash = await files.writeRequest(input.request)
    const created = createWork({
      agent: resolveAgent(this.config, NODE_INFO.intake.skill),
      workId,
      type: input.type,
      baseBranch: branch,
      baseCommit,
      settings,
      requestHash,
      // 이슈 기록은 Work를 만들 때 프로젝트 설정으로 정한다 (I96)
      ...(issueLogOn(project)
        ? {
            issue: {
              linked: input.issueNumber ?? null,
              mark: issueMarkId(workId, randomBytes(4).toString('hex')),
            },
          }
        : {}),
      at,
    })
    const runner = this.runner(project, files, created.work, workTitle(input.request))
    this.works.set(runner.key, runner)
    await runner.enqueue(() => runner.apply(created.work, created.effects))
    return { ok: true, workKey: runner.key }
  }

  // ---------- 승인 (시나리오 4) ----------

  async approve(workKey: string, taskId: string, opts: ApproveOptions): Promise<CommandResult> {
    const runner = this.works.get(workKey)
    if (!runner) return { ok: false, error: 'Work가 없습니다' }
    return runner.approve(taskId, opts)
  }

  async review(workKey: string, taskId: string): Promise<ReviewView | null> {
    return (await this.works.get(workKey)?.review(taskId)) ?? null
  }

  /** 승인 화면의 [취소]: 자동 승인 카운트다운을 멈춘다 (4.3) */
  cancelCountdown(workKey: string, taskId: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.cancelCountdown(taskId))
  }

  answerQuestion(
    workKey: string,
    taskId: string,
    questionId: string,
    answers: unknown,
  ): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.answerQuestion(taskId, questionId, answers))
  }

  // ---------- 사람 조작 (시나리오 3-4, 3-5, 4.4) ----------

  /** Work의 명령을 부른다 */
  private withWork(
    workKey: string,
    fn: (runner: WorkRunner) => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const runner = this.works.get(workKey)
    return runner ? fn(runner) : Promise.resolve({ ok: false, error: 'Work가 없습니다' })
  }

  /** [즉시 중단] */
  interrupt(workKey: string, taskId: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.interrupt(taskId))
  }

  /** [재개], [세션 재개] */
  resume(workKey: string, taskId: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.resume(taskId))
  }

  /** [이 단계 새 세션으로 다시] (D114) */
  retry(workKey: string, taskId: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.retry(taskId))
  }

  /** [이 단계 끝나면 멈춤] */
  stopAfter(workKey: string, on: boolean): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.stopAfter(on))
  }

  /** [아카이브로 옮기기] */
  shelve(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.shelve())
  }

  /** 멈춘 Work의 [재개] */
  resumeWork(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.resumeWork())
  }

  /** [Work 포기] */
  abandon(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.abandon())
  }

  // ---------- 단계 선택 (6.2) ----------

  /** 단계 선택 대화상자의 미리 보기 (D82) */
  async stepPreview(
    workKey: string,
    node: NodeName,
    keepCode: boolean,
    type?: WorkType,
  ): Promise<StepPreviewResult> {
    const runner = this.works.get(workKey)
    return runner
      ? runner.stepPreview(node, keepCode, type)
      : { ok: false, error: 'Work가 없습니다' }
  }

  /** [단계 선택]의 [확인] */
  selectStep(workKey: string, input: SelectStepInput): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.selectStep(input))
  }

  // ---------- 전달 (시나리오 7) ----------

  /** [push]·[PR 생성] (7-4~7-6). 커밋 안 된 변경이 있으면 목록을 돌려준다 (7-5) */
  async deliver(workKey: string, input: DeliverInput): Promise<DeliverResult> {
    const runner = this.works.get(workKey)
    return runner ? runner.deliver(input) : { ok: false, error: 'Work가 없습니다' }
  }

  /** [AI 세션 열기] (7-5) */
  openCleanup(workKey: string, choice: DeliveryChoice): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.openCleanup(choice))
  }

  /** [정리 세션 닫기] (D137) */
  closeCleanup(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.closeCleanup())
  }

  /** [정리 끝 → push/PR 진행] (7-5) */
  async finishCleanup(workKey: string): Promise<DeliverResult> {
    const runner = this.works.get(workKey)
    return runner ? runner.finishCleanup() : { ok: false, error: 'Work가 없습니다' }
  }

  /** Work 완료 화면의 [다시 점검] (D118) */
  recheckWork(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.recheck())
  }

  // ---------- 정리 (시나리오 8) ----------

  /** [Work 정리]의 확인 요약 (8-1) */
  async cleanPreview(workKey: string): Promise<CleanPreviewResult> {
    const runner = this.works.get(workKey)
    return runner ? runner.cleanPreview() : { ok: false, error: 'Work가 없습니다' }
  }

  /** [Work 정리]의 [정리] (8-2) */
  clean(workKey: string, input: CleanInput): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.clean(input))
  }

  // ---------- PR 진행 (시나리오 10) ----------

  /** PR 패널의 [새로 고침] (D158) */
  prRefresh(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.refreshPr())
  }

  /** PR 패널의 [제외], [다시 넣기], [받기] (D160, D161, D170) */
  prItem(workKey: string, itemId: string, action: PrItemAction): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.prItem(itemId, action))
  }

  /** 머지 창을 열 때 (D176, D177) */
  async prMergeInfo(workKey: string): Promise<MergeInfoResult> {
    const runner = this.works.get(workKey)
    return runner ? runner.prMergeInfo() : { ok: false, error: 'Work가 없습니다' }
  }

  /** 머지 창의 [머지] (D176) */
  prMerge(workKey: string, input: MergeInput): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.prMerge(input))
  }

  /** [머지 없이 끝내기] (D179) */
  prEnd(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.prEnd())
  }

  /** 머지 뒤 정리 창을 열었다 (D178, D200) */
  prCleanOffered(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.prCleanOffered())
  }

  /** PR 패널의 [대응 시작] (시나리오 10-3) */
  prRespond(workKey: string, input: RespondStartInput): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.respond(input))
  }

  /** PR 패널의 [실패한 체크 다시 실행] (D175, D203) */
  prRerun(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.rerunChecks())
  }

  /** 이슈 기록의 [다시 시도] (D344): 남은 게시를 앞부터 다시 한다 */
  issueRetry(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.retryIssue())
  }

  // ---------- 재시작과 복구 (시나리오 9) ----------

  /** 끊긴 작업의 [다시 시도] (D123). 끊긴 전달은 커밋 안 된 변경이 남았으면 목록을 돌려준다 (7-5) */
  async retryOperation(workKey: string): Promise<DeliverResult> {
    const runner = this.works.get(workKey)
    return runner ? runner.retryOperation() : { ok: false, error: 'Work가 없습니다' }
  }

  /** 끊긴 작업의 [무시] (D123) */
  ignoreOperation(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.ignoreOperation())
  }

  /** 알림의 [확인] (D121, D124) */
  dismissNotice(workKey: string, id: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.dismissNotice(id))
  }

  /**
   * Work별 자동 승인, 질문 방식, 대응 자동 시작 (D72, D154). 검사한 뒤 넣는다. 준 키만 바꾸고, 빈 값(빈 객체, null)이면
   * 그 키를 앱 설정으로 되돌린다. PR 진행 중에도 받는다 (D209)
   */
  updateWorkSettings(workKey: string, settings: unknown): Promise<CommandResult> {
    const r = checkWorkSettings(settings)
    if (!r.ok) return Promise.resolve({ ok: false, error: r.error })
    return this.withWork(workKey, (w) => w.updateSettings(r.value))
  }

  // ---------- 터미널 ----------

  /** 터미널 키 <project-id>/<work-id>/<task-id>를 Work와 task로 나눈다 */
  private terminal(key: string): { runner: WorkRunner; taskId: string } | null {
    const i = key.lastIndexOf('/')
    const runner = i > 0 ? this.works.get(key.slice(0, i)) : undefined
    return runner ? { runner, taskId: key.slice(i + 1) } : null
  }

  async terminalAttach(key: string): Promise<TerminalBacklog> {
    const t = this.terminal(key)
    return t ? t.runner.attach(t.taskId) : { data: '', next: 0, live: false }
  }

  terminalWrite(key: string, data: string): void {
    const t = this.terminal(key)
    t?.runner.write(t.taskId, data)
  }

  terminalResize(key: string, cols: number, rows: number): void {
    if (cols <= 0 || rows <= 0) return
    this.size = { cols, rows }
    const t = this.terminal(key)
    t?.runner.resize(t.taskId, cols, rows)
  }
}
