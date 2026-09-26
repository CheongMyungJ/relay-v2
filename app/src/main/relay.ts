// 앱의 조립 (I26). 저장소를 읽고, 훅 서버를 띄우고, 프로젝트 등록(시나리오 0)과 Work 생성(시나리오 1),
// 재시작 조정(시나리오 9), 세션 상한과 대기열(D18), 앱 설정(D70)을 맡는다. Work 하나의 흐름은 WorkRunner가 맡는다.
// Electron을 import하지 않으므로 흐름 시험이 Vitest(Node)에서 이 코드를 그대로 불러 쓴다.
// 창과 알림, 렌더러로 보내기는 UiPort로 받는다.
import path from 'node:path'
import {
  addWorktree,
  branches as gitBranches,
  commitOf,
  fetchBranch,
  hasRemote,
} from '../adapters/git'
import { HookServer } from '../adapters/hooks'
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
import { applyConfigPatch, checkWorkSettings } from '../core/config'
import { createWork } from '../core/machine'
import { localIso, nextWorkId } from '../core/records'
import { DEFAULT_CONFIG, type AppConfig, type WorkSettings } from '../shared/config'
import type { ProjectState } from '../shared/project'
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
} from '../shared/views'
import type { WorkState } from '../shared/work'
import { SessionPool } from './pool'
import type { UiPort } from './ports'
import { inspectProject, prepareProject, type ProjectEnv } from './projects'
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

  private constructor(private readonly o: RelayOptions) {
    this.env = o.env ?? process.env
  }

  /**
   * 저장소를 읽고 훅 서버를 띄우고 재시작 조정을 한다 (시나리오 9, D75, D78).
   * 고아 프로세스 종료(D76)와 끊긴 작업 알림(D77)은 M6에서 넣는다.
   */
  static async open(o: RelayOptions): Promise<Relay> {
    const relay = new Relay(o)
    await relay.load()
    return relay
  }

  private async load(): Promise<void> {
    const { config, warning } = await loadConfig(this.o.home)
    this.config = config
    if (warning) this.warnings.push(warning)
    await this.hooks.listen()
    const loaded: WorkRunner[] = []
    for (const project of await loadProjects(this.o.home)) {
      this.projects.set(project.project_id, project)
      for (const id of await workIds(this.o.home, project.project_id)) {
        const files = new WorkFiles(workDir(this.o.home, project.project_id, id))
        try {
          const work = await files.load()
          if (!work) continue
          const title = workTitle(await files.readRequest())
          const runner = this.runner(project, files, work, title)
          this.works.set(runner.key, runner)
          loaded.push(runner)
        } catch (e) {
          this.warnings.push(`${project.project_id}/${id}: work.json을 읽을 수 없음 (${String(e)})`)
        }
      }
    }
    // 재시작 조정 (시나리오 9). Work마다 따로라 함께 한다
    await Promise.all(loaded.map((r) => r.reconcile()))
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
    }
  }

  private runner(
    project: ProjectState,
    files: WorkFiles,
    work: WorkState,
    title: string,
  ): WorkRunner {
    const tree = worktreeDir(this.o.home, project.project_id, work.work_id)
    return new WorkRunner(this.context(), project, files, tree, work, title)
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
   * 세션 상한을 올리면 대기열의 task를 바로 시작한다.
   */
  updateConfig(patch: unknown): Promise<CommandResult & { config?: AppConfig }> {
    const run = this.configQueue.then(async (): Promise<CommandResult & { config?: AppConfig }> => {
      const r = applyConfigPatch(this.config, patch)
      if (!r.ok) return { ok: false, error: r.error }
      await saveConfig(this.o.home, r.value)
      this.config = r.value
      this.pool.fill()
      return { ok: true, config: r.value }
    })
    this.configQueue = run.catch(() => undefined)
    return run
  }

  // ---------- 프로젝트 등록 (시나리오 0) ----------

  private projectEnv(): ProjectEnv {
    return { env: this.env, ghBin: this.o.ghBin ?? 'gh', registered: [...this.projects.values()] }
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
   * Work별 질문 방식을 받으면 work.json에 둔다 (D72).
   */
  async createWork(projectId: string, input: NewWorkInput): Promise<CreateWorkResult> {
    const project = this.projects.get(projectId)
    if (!project) return { ok: false, error: '프로젝트가 없습니다' }
    // work-id를 겹치지 않게 정하려고 한 번에 하나씩 만든다
    if (this.creating) return { ok: false, error: '다른 Work를 만드는 중입니다' }
    if (!input.request.trim()) return { ok: false, error: '요청을 입력하세요' }
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
    settings: WorkSettings,
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
      await addWorktree(repo, tree, `${RELAY_BRANCH}${workId}`, baseCommit, { env })
    } catch (e) {
      return { ok: false, error: `worktree를 만들지 못했습니다. ${String(e)}` }
    }

    const files = new WorkFiles(workDir(this.o.home, project.project_id, workId))
    await files.writeRequest(input.request)
    const created = createWork({ workId, baseBranch: branch, baseCommit, settings, at })
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

  /** 멈춘 Work의 [재개] */
  resumeWork(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.resumeWork())
  }

  /** [Work 포기] */
  abandon(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.abandon())
  }

  /** Work별 질문 방식 (D72). 검사한 뒤 넣는다 */
  updateWorkSettings(workKey: string, settings: unknown): Promise<CommandResult> {
    const r = checkWorkSettings(settings)
    if (!r.ok) return Promise.resolve({ ok: false, error: r.error })
    // 질문 방식을 모두 앱 설정으로 되돌리면 question_mode를 비운다
    return this.withWork(workKey, (w) =>
      w.updateSettings({ question_mode: r.value.question_mode ?? {} }),
    )
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
