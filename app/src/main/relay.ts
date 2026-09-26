// 앱의 조립 (I26). 저장소를 읽고, 훅 서버를 띄우고, 프로젝트 등록(시나리오 0)과 Work 생성(시나리오 1)을
// 맡는다. Work 하나의 흐름은 WorkRunner가 맡는다. Electron을 import하지 않으므로 흐름 시험이
// Vitest(Node)에서 이 코드를 그대로 불러 쓴다. 창과 알림, 렌더러로 보내기는 UiPort로 받는다.
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
  saveProject,
  workDir,
  workIds,
  worktreeDir,
} from '../adapters/store'
import { createWork } from '../core/machine'
import { localIso, nextWorkId } from '../core/records'
import { DEFAULT_CONFIG, type AppConfig } from '../shared/config'
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
  private readonly warnings: string[] = []
  private size = { cols: 120, rows: 32 }
  private creating = false

  private constructor(private readonly o: RelayOptions) {
    this.env = o.env ?? process.env
  }

  /** 저장소를 읽고 훅 서버를 띄운다. 재시작 때의 상태 조정은 M3에서 넣는다 */
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
        } catch (e) {
          this.warnings.push(`${project.project_id}/${id}: work.json을 읽을 수 없음 (${String(e)})`)
        }
      }
    }
  }

  /** 살아 있는 세션을 모두 끝내고 훅 서버를 닫는다 */
  async close(): Promise<void> {
    await Promise.all([...this.works.values()].map((w) => w.shutdown()))
    await this.hooks.close()
  }

  private context(): RunnerContext {
    return {
      env: this.env,
      skills: this.o.skills,
      hooks: this.hooks,
      ui: this.o.ui,
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
   * fetch가 실패하면 Work를 만들지 않는다. M2는 한 번에 Work 하나만 진행한다.
   */
  async createWork(projectId: string, input: NewWorkInput): Promise<CreateWorkResult> {
    const project = this.projects.get(projectId)
    if (!project) return { ok: false, error: '프로젝트가 없습니다' }
    if (this.creating || [...this.works.values()].some((w) => w.hasLiveSession())) {
      return { ok: false, error: '진행 중인 Work가 있습니다. M2는 한 번에 Work 하나만 진행합니다' }
    }
    if (!input.request.trim()) return { ok: false, error: '요청을 입력하세요' }
    const branch = input.baseBranch.trim()
    if (!branch) return { ok: false, error: '기준 브랜치를 고르세요' }
    this.creating = true
    try {
      return await this.create(project, input, branch)
    } finally {
      this.creating = false
    }
  }

  private async create(
    project: ProjectState,
    input: NewWorkInput,
    branch: string,
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
    const created = createWork({ workId, baseBranch: branch, baseCommit, at })
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
