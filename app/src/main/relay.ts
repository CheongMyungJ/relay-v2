// 앱의 조립 (I26). 저장소를 읽고, 훅 서버를 띄우고, 프로젝트 등록(시나리오 0)과 Work 생성(시나리오 1),
// 재시작 때의 고아 프로세스 종료와 조정(시나리오 9), 세션 상한과 대기열(D18), 앱 설정(D70)을 맡는다.
// Work 하나의 흐름은 WorkRunner가 맡는다.
// Electron을 import하지 않으므로 흐름 시험이 Vitest(Node)에서 이 코드를 그대로 불러 쓴다.
// 창과 알림, 렌더러로 보내기는 UiPort로 받는다.
import { randomBytes } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import {
  addDetachedWorktree,
  addWorktree,
  branches as gitBranches,
  commitOf,
  fetchBranch,
  hasRemote,
  isGitlinkAt,
  remoteUrl,
  removeWorktree,
  submoduleList,
} from '../adapters/git'
import { filesAt, namesInCode, readKnowledgeAt } from '../adapters/knowledge'
import { knowledgeEnabled } from '../core/knowledge'
import { anchorNames, tidyCandidates, tidyRequest } from '../core/knowledge-tidy'
import { HookServer } from '../adapters/hooks'
import { killOrphans } from '../adapters/pty'
import fsp from 'node:fs/promises'
import type { Stats } from 'node:fs'
import {
  WorkFiles,
  loadConfig,
  loadProjects,
  loadSessions,
  removeProjectDir,
  saveConfig,
  saveProject,
  saveSession,
  sessionDir,
  sessionIds,
  unregisterProject,
  workDir,
  workIds,
  worktreeDir,
  worktreeIds,
  worktreesDir,
} from '../adapters/store'
import { projectRemoveBlock } from '../core/cleanup'
import { applyConfigPatch, checkProjectSettings, checkWorkSettings } from '../core/config'
import { createWork } from '../core/machine'
import { NODE_INFO } from '../core/pipeline'
import { issueMarkId, type InheritedIssue } from '../core/issue'
import {
  DEFAULT_BRANCH_RULE,
  checkBranchName,
  pickWorkBranch,
  renderBranchRule,
  ruleHasSlug,
  workIdsInBranches,
} from '../core/branch'
import { localIso, nextSessionId, nextWorkId, targetBranch, workBranch } from '../core/records'
import { recordedProcesses, type RecordedProcess } from '../core/recovery'
import { resolveAgent } from '../shared/agent'
import { DEFAULT_CONFIG, type AppConfig, type WorkSettingsPatch } from '../shared/config'
import { issueLogOn, projectName, type ProjectChecks, type ProjectState } from '../shared/project'
import type { DraftRef, SessionRecord } from '../shared/session'
import type {
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
  PrItemAction,
  TidyView,
  ProjectInspection,
  ProjectRemovePreviewResult,
  ProjectView,
  RespondStartInput,
  ReviewView,
  SessionView,
  SubmoduleView,
  TerminalBacklog,
} from '../shared/views'
import { WORK_TYPES, type DeliveryChoice, type WorkState, type WorkType } from '../shared/work'
import { SessionPool } from './pool'
import type { UiPort } from './ports'
import { PASTE_KEEP_MS, linkPath, opensSafely, realLinkPath, type LinkFs } from './links'
import {
  checkGh,
  inspectProject,
  prepareProject,
  prepareSubmoduleProject,
  type ProjectEnv,
} from './projects'
import { SessionRunner, type SessionContext } from './session'
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
  /** 작업 브랜치 끝의 임의의 4자를 뽑는 [0, 1)의 수 (D427). 기본은 Math.random이다(시험에서 고정한다) */
  random?: () => number
  /** 앱 설정을 읽었거나 바꿨다. 테마(D335)처럼 Electron이 적용할 것을 main이 적용한다 */
  onConfig?: (config: AppConfig) => void
  /**
   * 앱에 묶은 사용자 문서 README.md (I134). 기본 세션의 안내가 가리킨다. 없으면 스킬 원본 옆이다(설치본은
   * resources/README.md, 개발 중과 시험은 레포의 README.md)
   */
  readme?: string
}

/** 터미널을 가진 것: Work(task, 보조 세션)와 기본 세션 */
interface TerminalOwner {
  attach(id: string): Promise<TerminalBacklog>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  /** 터미널의 폴더. 출력의 상대 경로를 여기서 푼다 (D411) */
  cwd(id: string): string
}

/** 예전 되감기의 백업 브랜치 relay/<work-id>-discarded-<n> (D115, D424). 기준 브랜치로 고르지 않는다 */
const DISCARDED_BACKUP = /^relay\/w-\d{8}-\d+-discarded-\d+$/

/** 터미널 경로를 풀 때 링크를 따라가지 않고 보는 파일 시스템 (D412) */
const LINK_FS: LinkFs = {
  lstat: (file) => fsp.lstat(file).catch(() => null),
  readlink: (file) => fsp.readlink(file).catch(() => null),
}

/**
 * 다시 한 Work가 이어 쓸 원래 Work의 이슈 (D421, I153): 같은 프로젝트(이슈는 레포의 것)이고, 이슈가 있고 아직 닫히지 않았고,
 * 사람이 이슈 번호 칸을 바꾸지 않았을 때다. 아니면 undefined라 새 Work는 이슈 번호 칸대로 한다
 */
function inheritedIssue(
  original: WorkRunner,
  project: ProjectState,
  input: NewWorkInput,
): InheritedIssue | undefined {
  const from = original.work.issue
  if (original.project.project_id !== project.project_id || !from?.number || from.closed) return
  if ((input.issueNumber ?? null) !== from.number) return
  return { work_id: original.work.work_id, linked: from.linked, number: from.number, url: from.url }
}

export class Relay {
  private readonly projects = new Map<string, ProjectState>()
  private readonly works = new Map<string, WorkRunner>()
  /** 기본 세션 (시나리오 12). 키는 session-id다 */
  private readonly sessions = new Map<string, SessionRunner>()
  private readonly hooks = new HookServer()
  private readonly env: NodeJS.ProcessEnv
  private config: AppConfig = DEFAULT_CONFIG
  /** 살아 있는 세션의 합계 상한과 대기열 (D18). 상한은 판정하는 때의 설정을 쓴다 (D73) */
  private readonly pool = new SessionPool(() => this.config.session_limit)
  private readonly warnings: string[] = []
  private size = { cols: 120, rows: 32 }
  private creating = false
  /** [등록 해제]하는 중인 프로젝트 (D409). 그동안 그 프로젝트에 Work를 만들거나 지우지 않고, 같은 폴더를 등록하지 않는다 */
  private readonly removing = new Set<string>()
  /** [기록 지우기]하는 중인 Work (D409). 키는 Work 키다. [등록 해제]는 이것이 끝나기를 기다린다 */
  private readonly deleting = new Map<string, Promise<CommandResult>>()
  private creatingSession = false
  /** 설정 바꾸기를 차례로 한다. 겹친 두 바꾸기가 서로의 값을 지우지 않게 */
  private configQueue: Promise<unknown> = Promise.resolve()
  /** project.json 고치기의 차례 (updateProject) */
  private projectWrites: Promise<unknown> = Promise.resolve()
  /** 준비하는 중인 서브모듈 (prepareSubmodule). 키는 메인 프로젝트 id와 서브모듈 경로다 */
  private readonly preparing = new Map<string, Promise<CommandResult & { project?: ProjectView }>>()

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
    for (const record of await loadSessions(this.o.home, this.warnings)) {
      this.sessions.set(record.id, this.sessionRunner(record))
    }
    // 1. 고아 프로세스 (시나리오 9-1): 모든 Work와 기본 세션(D402)의 기록을 모아 한 번에 확인하고 끝낸다
    const killed = await this.killOrphans(loaded, [...this.sessions.values()])
    // 기본 세션은 프로세스 기록만 지우고 대화는 남긴다. 끝낸 것은 경고로 알린다
    for (const r of this.sessions.values()) {
      for (const p of killed.get(r) ?? [])
        this.warnings.push(
          `기본 세션 "${r.view().name}": 앱을 다시 켜며 남아 있던 프로세스(PID ${p.pid})를 끝냈습니다. [열기]로 대화를 잇습니다`,
        )
      try {
        await r.reconcile()
        await r.start()
      } catch (e) {
        this.warnings.push(`기본 세션 ${r.record.id}: 기록을 쓰지 못함 (${String(e)})`)
      }
    }
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
    // 남은 Work 초안을 읽는다 (D421). 기다리지 않는다. 감시는 초안을 쓰는 세션(task, 곁 세션)을 띄울 때 건다
    for (const r of loaded) if (!failed.has(r)) void r.refreshDrafts()
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
   * 기록한 claude 프로세스(task의 세션과 살아 있던 정리 세션·곁 세션, 기본 세션) 가운데 ID와 시작 시각이 같은 것이 살아
   * 있으면 트리째 끝낸다 (시나리오 9-1, D76, D126, D402). 시작 시각이 다르면 건드리지 않는다. 주인마다 끝낸 기록을 돌려준다
   */
  private async killOrphans(
    runners: readonly WorkRunner[],
    sessions: readonly SessionRunner[],
  ): Promise<Map<WorkRunner | SessionRunner, RecordedProcess[]>> {
    const records = [
      ...runners.flatMap((r) => recordedProcesses(r.work).map((p) => ({ r, p }))),
      ...sessions.flatMap((r) => recordedProcesses(r.record).map((p) => ({ r, p }))),
    ]
    const out = new Map<WorkRunner | SessionRunner, RecordedProcess[]>()
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
    await Promise.all([
      ...[...this.works.values()].map((w) => w.shutdown()),
      // 기본 세션도 끝낸다 (D406)
      ...[...this.sessions.values()].map((s) => s.shutdown()),
    ])
    await this.hooks.close()
  }

  /** 하던 PR 읽기가 모두 끝나기를 기다린다 (WorkRunner.prIdle). 시험 도구가 close 뒤에 부른다 */
  async settled(): Promise<void> {
    await Promise.all([...this.works.values()].map((w) => Promise.all([w.prIdle(), w.issueIdle()])))
  }

  /** 이 앱에서 살아 있는 세션이 있다. 앱을 끝낼 때 확인 창을 띄운다 (시나리오 3-6). 기본 세션도 센다 (D406) */
  hasLiveSessions(): boolean {
    return (
      [...this.works.values()].some((w) => w.hasLiveSession()) ||
      [...this.sessions.values()].some((s) => s.hasLiveSession())
    )
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
      projectIds: () => [...this.projects.keys()],
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
            branch: workBranch(w.work),
            baseCommit: w.work.base_commit,
          })),
      stackedOn: (projectId, branch, except) =>
        [...this.works.values()]
          .filter(
            (w) =>
              w.project.project_id === projectId &&
              w.work.work_id !== except &&
              (w.work.status === 'active' || w.work.status === 'stopped') &&
              targetBranch(w.work) === branch,
          )
          .map((w) => w.work.work_id),
      workBranches: (projectId) => this.workBranches(projectId),
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
    const origin = await remoteUrl(project.repo_path, 'origin', { env })
    const gh = (await checkGh(this.ghBin(), env, origin)).check
    const checks: ProjectChecks = {
      origin: origin !== null,
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
    const { tree, root } = this.workTree(project, work.work_id, work.integration !== undefined)
    return new WorkRunner(this.context(), project, files, tree, work, title, text, root)
  }

  /**
   * Work의 worktree와 메인 통합 검증 worktree (D414). 통합 검증이 있는 서브모듈 Work는 메인 worktree가
   * worktrees/<work-id>이고 이 Work의 worktree는 그 안의 서브모듈 자리(worktrees/<work-id>/<서브모듈 경로>)다. 아니면
   * root가 null이다. 이 배치는 여기서만 정한다
   */
  private workTree(
    project: ProjectState,
    workId: string,
    integrated: boolean,
  ): { tree: string; root: string | null } {
    const dir = worktreeDir(this.o.home, project.project_id, workId)
    if (!integrated || !project.parent) return { tree: dir, root: null }
    return { tree: path.join(dir, ...project.parent.path.split('/')), root: dir }
  }

  private at(): string {
    return localIso(this.o.now ? this.o.now() : new Date())
  }

  // ---------- 스냅샷 (I14) ----------

  snapshot(): AppSnapshot {
    return {
      projects: this.projectViews(),
      works: [...this.works.values()].map((w) => w.view()),
      sessions: this.sessionViews(),
      warnings: [...this.warnings],
    }
  }

  /** 기본 세션 목록 (D405): 최근에 만든 것이 앞이다 */
  private sessionViews(): SessionView[] {
    return [...this.sessions.values()]
      .map((s) => s.view())
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
  }

  private projectViews(): ProjectView[] {
    return [...this.projects.values()].map((p) => ({
      id: p.project_id,
      name: projectName(p),
      repoPath: p.repo_path,
      defaultBranch: p.default_branch,
      origin: p.checks.origin,
      gh: p.checks.gh,
      ghVersion: p.checks.gh_version ?? null,
      allowedBots: p.allowed_bots ?? [],
      mergeMethod: p.merge_method ?? null,
      issueLog: issueLogOn(p),
      branchRule: p.branch_rule ?? DEFAULT_BRANCH_RULE,
      branchSlug: ruleHasSlug(p.branch_rule ?? DEFAULT_BRANCH_RULE),
      parent: p.parent ? { id: p.parent.project_id, path: p.parent.path } : null,
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
      // 기본 세션의 다음 엔진 (D399)
      this.o.ui.sessions(this.sessionViews())
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
    // 같은 폴더(같은 id)의 등록을 해제하는 중이면 그 디렉터리를 지우는 중이다 (D409)
    if (this.removing.has(r.project.project_id))
      return { ok: false, error: '이 폴더의 등록을 해제하는 중입니다. 끝난 뒤 다시 등록하세요' }
    await saveProject(this.o.home, r.project)
    this.projects.set(r.project.project_id, r.project)
    this.o.ui.projects(this.projectViews())
    // 초안의 project는 등록된 프로젝트만 받는다 (I135)
    this.refreshAllDrafts()
    return { ok: true, projectId: r.project.project_id }
  }

  /**
   * [등록 해제]를 막는 까닭과 함께 지울 Work (D408, D409): 보관되지 않은 Work, 앱이 읽지 못한 Work 기록(works/에 있는데
   * 목록에 없음), 남은 worktree 폴더를 core 규칙으로 본다
   */
  private async removeCheck(
    projectId: string,
  ): Promise<{ block: string | null; runners: WorkRunner[] }> {
    const runners = [...this.works.values()].filter((w) => w.project.project_id === projectId)
    const loaded = new Set(runners.map((w) => w.work.work_id))
    const unread = (await workIds(this.o.home, projectId)).filter((id) => !loaded.has(id))
    const block = projectRemoveBlock(
      runners.map((w) => w.work),
      {
        unread,
        worktrees: await worktreeIds(this.o.home, projectId),
        worktreesDir: worktreesDir(this.o.home, projectId),
      },
    )
    return { block, runners }
  }

  /** [등록 해제] 창을 열 때 (D408): 막는 까닭과 함께 지울 Work 수. 판정은 [등록 해제]가 다시 한다 */
  async projectRemovePreview(projectId: string): Promise<ProjectRemovePreviewResult> {
    if (!this.projects.has(projectId)) return { ok: false, error: '프로젝트가 없습니다' }
    try {
      const { block, runners } = await this.removeCheck(projectId)
      const shelved = runners.filter((w) => w.work.shelved_at !== undefined).length
      const subs = this.subProjects(projectId)
      return {
        ok: true,
        preview: {
          block: block ?? (subs.length ? subProjectsBlock(subs) : null),
          works: runners.length,
          shelved,
        },
      }
    } catch (e) {
      return { ok: false, error: `확인하지 못함: ${String(e)}` }
    }
  }

  /**
   * 프로젝트 우클릭 [등록 해제] (D408, D409). Work가 모두 보관됐을 때만 받는다(Work가 없어도 된다). project.json을 먼저
   * 지우고, Work의 runner를 함께 멈춘 뒤 프로젝트 디렉터리를 한 번에 지운다. 레포와 브랜치는 건드리지 않는다.
   * project.json 고치기와 같은 줄에서 해 다시 점검이나 설정 저장이 지운 project.json을 다시 쓰지 않는다
   */
  removeProject(projectId: string): Promise<CommandResult> {
    const run = this.projectWrites.then(async (): Promise<CommandResult> => {
      if (!this.projects.has(projectId)) return { ok: false, error: '프로젝트가 없습니다' }
      // 검사와 표시 사이에 기다림이 없어야 한다: 이 뒤로 그 프로젝트에 Work를 만들거나 지우지 않는다
      if (this.creating) return { ok: false, error: '다른 Work를 만드는 중입니다' }
      this.removing.add(projectId)
      try {
        // 하던 [기록 지우기]가 끝나기를 기다린다. 실패했으면 아래 검사가 남은 Work로 다시 본다
        await Promise.all(
          [...this.deleting]
            .filter(([key]) => key.startsWith(`${projectId}/`))
            .map(([, deleting]) => deleting.catch(() => undefined)),
        )
        const { block, runners } = await this.removeCheck(projectId)
        if (block) return { ok: false, error: block }
        const subs = this.subProjects(projectId)
        if (subs.length) return { ok: false, error: subProjectsBlock(subs) }
        try {
          await unregisterProject(this.o.home, projectId)
        } catch (e) {
          return { ok: false, error: `project.json을 지우지 못함: ${String(e)}` }
        }
        // 이제 다시 켜도 이 프로젝트를 읽지 않는다. 기록은 아래에서 디렉터리째 지운다
        await Promise.all(runners.map((r) => r.remove({ files: false })))
        for (const r of runners) {
          this.works.delete(r.key)
          this.o.ui.workRemoved(r.key)
        }
        this.projects.delete(projectId)
        this.o.ui.projects(this.projectViews())
        // 이 프로젝트의 초안은 모르는 프로젝트가 된다 (D404)
        this.refreshAllDrafts()
        try {
          await removeProjectDir(this.o.home, projectId)
        } catch (e) {
          return {
            ok: false,
            error: `등록은 해제했지만 프로젝트 폴더를 다 지우지 못함: ${String(e)}. 폴더를 직접 지우세요`,
          }
        }
        return { ok: true }
      } finally {
        this.removing.delete(projectId)
      }
    })
    this.projectWrites = run.catch(() => undefined)
    return run
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
        ...(r.value.branch_rule === undefined
          ? {}
          : { branch_rule: r.value.branch_rule || undefined }),
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

  /** 새 Work 대화상자의 작업 브랜치 이름 (D426): 다음 work-id로 규칙을 채운다. 끝의 임의의 4자는 만들 때 붙인다 */
  async branchName(projectId: string, type: WorkType, slug: string): Promise<string> {
    const project = this.projects.get(projectId)
    if (!project) return ''
    const local = await gitBranches(project.repo_path, { env: this.env })
      .then((b) => b.local)
      .catch(() => [])
    const workId = await this.nextWorkId(project, this.at(), local)
    return renderBranchRule(project.branch_rule ?? DEFAULT_BRANCH_RULE, { workId, type, slug })
  }

  /**
   * 기준 브랜치와 머지 대상 목록 (시나리오 1, D428). 프로젝트의 기본 브랜치를 맨 앞에 둔다. 앞 Work의 작업 브랜치도 넣는다:
   * 그 위에 이어 쌓고 한 번에 기본 브랜치로 넣을 수 있다. 예전 되감기의 백업 브랜치(D115, D424)만 뺀다
   */
  async branches(projectId: string): Promise<string[]> {
    const project = this.projects.get(projectId)
    if (!project) return []
    const { local, remote } = await gitBranches(project.repo_path, { env: this.env })
    // 사람이 지은 Work 브랜치가 백업 브랜치의 모양과 같을 수 있다(D426): Work 브랜치는 빼지 않는다
    const works = new Set(this.workBranches(projectId))
    const names = [...new Set([...local, ...remote])].filter(
      (b) => works.has(b) || !DISCARDED_BACKUP.test(b),
    )
    const rest = names.filter((b) => b !== project.default_branch).sort()
    return [project.default_branch, ...rest]
  }

  /** 이 프로젝트의 모든 Work의 작업 브랜치 (D425) */
  private workBranches(projectId: string): string[] {
    return [...this.works.values()]
      .filter((w) => w.project.project_id === projectId)
      .map((w) => workBranch(w.work))
  }

  /** 메인 프로젝트의 서브모듈 프로젝트 (D413) */
  private subProjects(projectId: string): ProjectState[] {
    return [...this.projects.values()].filter((p) => p.parent?.project_id === projectId)
  }

  /**
   * 새 Work 대화상자의 대상 목록 (D413): 메인 프로젝트의 서브모듈과 이미 만든 서브모듈 프로젝트. 서브모듈 프로젝트나
   * 읽지 못한 레포면 빈 목록이다
   */
  async submodules(projectId: string): Promise<SubmoduleView[]> {
    const project = this.projects.get(projectId)
    if (!project || project.parent) return []
    const list = await submoduleList(project.repo_path, { env: this.env }).catch(() => [])
    const subs = this.subProjects(projectId)
    return list.map((e) => ({
      ...e,
      projectId: subs.find((p) => p.parent?.path === e.path)?.project_id ?? null,
    }))
  }

  /**
   * 새 Work 대화상자에서 서브모듈을 대상으로 고른다 (D413). 서브모듈 프로젝트가 없으면 만들고(메인 체크아웃에 받지 않았으면
   * 받는다), 있으면 origin과 gh를 다시 점검한다. 받기는 오래 걸릴 수 있어 project.json 고치기 줄 밖에서 하고, 쓰기만 그
   * 줄에서 한다. 같은 서브모듈을 겹쳐 고르면 앞의 준비를 함께 기다린다
   */
  prepareSubmodule(
    projectId: string,
    subPath: string,
  ): Promise<CommandResult & { project?: ProjectView }> {
    const key = `${projectId}\0${subPath}`
    const running = this.preparing.get(key)
    if (running) return running
    const run = this.prepareSubmoduleNow(projectId, subPath).finally(() =>
      this.preparing.delete(key),
    )
    this.preparing.set(key, run)
    return run
  }

  private async prepareSubmoduleNow(
    projectId: string,
    subPath: string,
  ): Promise<CommandResult & { project?: ProjectView }> {
    const main = this.projects.get(projectId)
    if (!main) return { ok: false, error: '프로젝트가 없습니다' }
    if (this.removing.has(projectId))
      return { ok: false, error: '등록을 해제하는 중인 프로젝트입니다' }
    const r = await prepareSubmoduleProject(main, subPath, this.at(), this.projectEnv())
    if (!r.ok) return r
    const made = r.project
    const save = this.projectWrites.then(
      async (): Promise<CommandResult & { project?: ProjectView }> => {
        // 받는 동안 메인 프로젝트를 해제했거나, 다시 점검·설정 저장이 같은 프로젝트를 고쳤을 수 있다
        if (!this.projects.has(projectId) || this.removing.has(projectId))
          return { ok: false, error: '메인 프로젝트의 등록이 해제되었습니다' }
        if (this.removing.has(made.project_id))
          return { ok: false, error: '이 서브모듈 프로젝트의 등록을 해제하는 중입니다' }
        const latest = this.projects.get(made.project_id)
        await this.saveProjectState(
          latest ? { ...latest, checks: made.checks, parent: made.parent } : made,
        )
        const view = this.projectViews().find((p) => p.id === made.project_id)
        return view ? { ok: true, project: view } : { ok: true }
      },
    )
    this.projectWrites = save.catch(() => undefined)
    return save
  }

  /**
   * 새 Work 대화상자의 지식 정리 후보 (D393): 기준 브랜치의 지식 파일과 코드에서 모델 없이 찾는다. 지식 관리를 끄면
   * (RELAY_KNOWLEDGE=off) 후보가 없다
   */
  async knowledgeTidy(
    projectId: string,
    baseBranch: string,
    location: 'local' | 'remote',
  ): Promise<TidyView> {
    const project = this.projects.get(projectId)
    const branch = baseBranch.trim()
    const none: TidyView = { candidates: [], request: '' }
    if (!project || !branch || !knowledgeEnabled(this.env)) return none
    const opts = { env: this.env }
    const repo = project.repo_path
    const ref = location === 'remote' ? `origin/${branch}` : branch
    try {
      const files = await filesAt(repo, ref, opts)
      const entries = await readKnowledgeAt(repo, ref, files, opts)
      if (!entries.length) return none
      // 코드에서 이름을 찾지 못하면(git grep 실패) 아래 catch로 후보 없이 끝낸다: 모든 anchor를 낡았다고 하지 않는다
      const candidates = tidyCandidates(entries, {
        found: await namesInCode(repo, ref, anchorNames(entries), opts),
        files,
      })
      return candidates.length ? { candidates, request: tidyRequest(candidates) } : none
    } catch {
      return none
    }
  }

  // ---------- Work 생성 (시나리오 1) ----------

  /**
   * work-id, 작업 브랜치(D425~D427)와 worktree, 기준 커밋(D97), request.md, work.json을 만들고
   * intake task를 시작한다. 기준 위치가 원격이면 fetch한 origin/<브랜치>에서 분기하고,
   * fetch가 실패하면 Work를 만들지 않는다. 세션 상한을 넘으면 intake는 대기열에서 기다린다 (D18).
   * Work별 자동 승인과 질문 방식을 받으면 work.json에 둔다 (D72). 고른 업무 유형을 work.json에 적는다 (D236).
   */
  async createWork(projectId: string, input: NewWorkInput): Promise<CreateWorkResult> {
    const project = this.projects.get(projectId)
    if (!project) return { ok: false, error: '프로젝트가 없습니다' }
    if (this.removing.has(projectId))
      return { ok: false, error: '등록을 해제하는 중인 프로젝트입니다' }
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
    const target = input.targetBranch?.trim()
    if (input.targetBranch !== undefined && !target) {
      return { ok: false, error: '머지 대상 브랜치를 고르세요' }
    }
    const badTarget = target ? checkBranchName(target) : null
    if (badTarget) return { ok: false, error: `머지 대상: ${badTarget}` }
    if (input.integration) {
      const main = project.parent ? this.projects.get(project.parent.project_id) : undefined
      if (!main) return { ok: false, error: '메인 통합 검증은 서브모듈 프로젝트에서만 고릅니다' }
      if (!input.integration.baseBranch.trim())
        return { ok: false, error: '메인 레포의 기준 브랜치를 고르세요' }
    }
    const settings = checkWorkSettings(input.settings ?? {})
    if (!settings.ok) return { ok: false, error: settings.error }
    // Work에서 쓴 초안이면 다시 하기다 (D421): 원래 Work를 적고, 그 이슈를 이어 쓰고, 고르면 원래 Work를 포기한다
    const source = input.draft?.source
    const original = source?.kind === 'work' ? this.works.get(source.id) : undefined
    if (source?.kind === 'work' && !original)
      return { ok: false, error: '초안을 쓴 Work가 없습니다' }
    // 포기할 수 없으면(끊긴 작업, 열린 정리 세션 포함) 새 Work를 만들기 전에 막는다
    const blocked = !input.abandonOriginal
      ? null
      : original
        ? original.redoAbandonBlock()
        : '원래 Work가 없어 포기할 수 없습니다'
    if (blocked) return { ok: false, error: blocked }
    // 원래 Work의 이슈는 원래 Work를 포기할 때만 이어 쓴다: 둘이 같은 이슈를 쓰면 먼저 끝난 쪽이 닫는다
    const inherited =
      original && input.abandonOriginal ? inheritedIssue(original, project, input) : undefined
    this.creating = true
    let r: CreateWorkResult
    try {
      r = await this.create(
        project,
        input,
        { base: branch, target },
        settings.value,
        original?.work,
        inherited,
      )
    } finally {
      this.creating = false
    }
    // 초안으로 만들었으면 그 초안을 지운다 (D404). 지우지 못해도 Work는 생겼다
    if (r.ok && input.draft) await this.removeDraft(input.draft)
    if (r.ok && original && input.abandonOriginal) {
      // 새 Work는 생겼으니 포기하지 못해도 새 Work를 연다. 원래 Work에 알린다
      const workId = this.works.get(r.workKey)?.work.work_id ?? r.workKey
      const a = await original.abandon({ redoBy: workId, issueKept: inherited !== undefined })
      if (!a.ok) original.redoAbandonFailed(workId, a.error)
    }
    return r
  }

  private async create(
    project: ProjectState,
    input: NewWorkInput,
    /** 확인한 기준 브랜치와 머지 대상(없으면 기준 브랜치, D428) */
    branches: { base: string; target: string | undefined },
    settings: WorkSettingsPatch,
    original?: WorkState,
    inherited?: InheritedIssue,
  ): Promise<CreateWorkResult> {
    const branch = branches.base
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
    const main =
      input.integration && project.parent ? this.projects.get(project.parent.project_id) : null
    let integration: WorkState['integration']
    if (main && input.integration) {
      const r = await this.integrationBase(main, project, input.integration)
      if (!r.ok) return r
      integration = r.base
    }

    const at = this.at()
    const existing = await gitBranches(repo, { env })
    const workId = await this.nextWorkId(project, at, existing.local)
    const named = pickWorkBranch({
      rule: project.branch_rule ?? DEFAULT_BRANCH_RULE,
      name: input.branchName ?? null,
      slug: input.slug ?? '',
      workId,
      type: input.type,
      existing: [...existing.local, ...existing.remote],
      ...(this.o.random ? { random: this.o.random } : {}),
    })
    if (!named.ok) return named
    const { tree, root } = this.workTree(project, workId, integration !== undefined)
    // 메인 통합 검증 worktree를 먼저 만들고 그 안의 서브모듈 자리(빈 폴더)에 이 Work의 worktree를 만든다 (D414)
    if (main && integration && root) {
      try {
        await addDetachedWorktree(main.repo_path, root, integration.base_commit, { env })
      } catch (e) {
        return { ok: false, error: `메인 통합 검증 worktree를 만들지 못했습니다. ${String(e)}` }
      }
    }
    try {
      await addWorktree(repo, tree, named.branch, baseCommit, { env })
    } catch (e) {
      if (main && root)
        await removeWorktree(main.repo_path, root, { env, force: true }).catch(() => {})
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
      branch: named.branch,
      ...(branches.target ? { targetBranch: branches.target } : {}),
      ...(integration ? { integration } : {}),
      settings,
      requestHash,
      // 이슈 기록은 Work를 만들 때 프로젝트 설정으로 정한다 (I96)
      ...(issueLogOn(project)
        ? {
            issue: {
              linked: input.issueNumber ?? null,
              mark: issueMarkId(workId, randomBytes(4).toString('hex')),
              ...(inherited ? { from: inherited } : {}),
            },
          }
        : {}),
      ...(original ? { fromWork: original.work_id } : {}),
      at,
    })
    const runner = this.runner(project, files, created.work, workTitle(input.request))
    this.works.set(runner.key, runner)
    await runner.enqueue(() => runner.apply(created.work, created.effects))
    return { ok: true, workKey: runner.key }
  }

  /**
   * 이 날짜의 다음 work-id. 기록을 지운 Work의 브랜치가 남아 있으면 그 이름에 든 id(workIdsInBranches)도 쓰지 않는다: 같은
   * id의 두 Work가 헷갈린다
   */
  private async nextWorkId(project: ProjectState, at: string, local: readonly string[]) {
    return nextWorkId(at, [
      ...(await workIds(this.o.home, project.project_id)),
      ...workIdsInBranches(local),
    ])
  }

  /**
   * 메인 통합 검증 worktree의 기준 커밋 (D414). 기준 위치는 메인 레포의 것을 따로 고른다: 원격이면 메인 레포에서 fetch한
   * origin/<브랜치>다. fetch가 실패하거나, 그 커밋에 이 서브모듈의 자리(gitlink)가 없으면 Work를 만들지 않는다
   */
  private async integrationBase(
    main: ProjectState,
    project: ProjectState,
    pick: { baseBranch: string; baseLocation: 'local' | 'remote' },
  ): Promise<
    { ok: true; base: { base_branch: string; base_commit: string } } | { ok: false; error: string }
  > {
    const env = this.env
    const branch = pick.baseBranch.trim()
    const sub = project.parent?.path ?? ''
    let ref = branch
    if (pick.baseLocation === 'remote') {
      if (!(await hasRemote(main.repo_path, 'origin', { env }))) {
        return { ok: false, error: '메인 레포에 origin 원격이 없어 원격 기준으로 만들 수 없습니다' }
      }
      try {
        await fetchBranch(main.repo_path, branch, 'origin', { env })
      } catch (e) {
        return {
          ok: false,
          error: `메인 레포의 git fetch가 실패해 Work를 만들지 않았습니다. ${String(e)}`,
        }
      }
      ref = `origin/${branch}`
    }
    let commit: string
    try {
      commit = await commitOf(main.repo_path, ref, { env })
    } catch {
      return { ok: false, error: `메인 레포의 기준 브랜치를 찾을 수 없습니다: ${ref}` }
    }
    // 서브모듈이 없던 브랜치나 다른 경로로 옮긴 브랜치면 서브모듈 자리가 없어 통합 검증이 되지 않는다
    if (!(await isGitlinkAt(main.repo_path, commit, sub, { env }).catch(() => false))) {
      return {
        ok: false,
        error: `메인 레포의 ${ref}에는 서브모듈 ${sub}이 없습니다. 메인 기준 브랜치를 바꾸거나 통합 검증을 끄세요`,
      }
    }
    return { ok: true, base: { base_branch: branch, base_commit: commit } }
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

  /** [이 단계 끝나면 멈춤] */
  stopAfter(workKey: string, on: boolean): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.stopAfter(on))
  }

  /** 머지 대상 브랜치 (D428). 브랜치 이름으로 쓸 수 있는지만 보고, 있는지는 PR을 만들 때 GitHub가 본다 */
  setTarget(workKey: string, branch: string): Promise<CommandResult> {
    const bad = checkBranchName(branch.trim())
    if (bad) return Promise.resolve({ ok: false, error: `머지 대상: ${bad}` })
    return this.withWork(workKey, (w) => w.setTarget(branch))
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

  /**
   * 우클릭 [기록 지우기] (D407). 보관되지 않은 완료·포기 Work는 받은 정리 확인으로 먼저 정리한다(시나리오 8과 같음).
   * 정리가 실패하면 지우지 않는다. 정리한 뒤 지우다 실패하면 보관됨으로 남는다. 같은 Work를 겹쳐 지우지 않는다
   */
  deleteWork(workKey: string, clean: CleanInput | null): Promise<CommandResult> {
    const runner = this.works.get(workKey)
    if (!runner) return Promise.resolve({ ok: false, error: 'Work가 없습니다' })
    if (this.removing.has(runner.project.project_id))
      return Promise.resolve({ ok: false, error: '등록을 해제하는 중인 프로젝트입니다' })
    if (this.deleting.has(workKey))
      return Promise.resolve({ ok: false, error: '이 Work를 지우는 중입니다' })
    const run = this.deleteNow(runner, clean).finally(() => this.deleting.delete(workKey))
    this.deleting.set(workKey, run)
    return run
  }

  private async deleteNow(runner: WorkRunner, clean: CleanInput | null): Promise<CommandResult> {
    if (runner.work.status !== 'archived') {
      if (!clean) return { ok: false, error: '정리하지 않은 Work임. 정리 확인과 함께 지우세요' }
      const r = await runner.clean(clean)
      if (!r.ok) return r
    }
    const r = await runner.remove()
    if (!r.ok) return r
    this.works.delete(runner.key)
    this.o.ui.workRemoved(runner.key)
    return { ok: true }
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

  /** [곁 세션 열기] (시나리오 11) */
  openSide(workKey: string, fresh: boolean): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.openSide(fresh))
  }

  /** [곁 세션 닫기] (시나리오 11) */
  closeSide(workKey: string): Promise<CommandResult> {
    return this.withWork(workKey, (w) => w.closeSide())
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

  // ---------- 기본 세션 (시나리오 12, D397~D406) ----------

  private sessionContext(): SessionContext {
    return {
      home: this.o.home,
      readme: this.o.readme ?? path.resolve(this.o.skills, '..', 'README.md'),
      env: this.env,
      hooks: this.hooks,
      config: () => this.config,
      at: () => this.at(),
      size: () => this.size,
      projects: () => [...this.projects.values()],
      works: () =>
        [...this.works.values()].map((w) => ({
          project: w.project,
          work: w.work,
          title: w.title,
          worktree: w.worktree,
          workDir: w.files.dir,
        })),
      sessionIds: () => [...this.sessions.keys()],
      terminal: (key, chunk) => this.o.ui.terminal(key, chunk),
      changed: () => this.o.ui.sessions(this.sessionViews()),
    }
  }

  private sessionRunner(record: SessionRecord): SessionRunner {
    return new SessionRunner(this.sessionContext(), record, sessionDir(this.o.home, record.id))
  }

  /** [새 세션] 창의 폴더 기본값 (D398): 설정의 session_dir, 빈 글이면 <RELAY_HOME>/home/ */
  defaultSessionDir(): string {
    return this.config.session_dir || path.join(this.o.home, 'home')
  }

  /**
   * [새 세션]의 [만들기] (시나리오 12-1). 폴더가 비면 기본값이다. 기본 폴더(<RELAY_HOME>/home/)는 없으면 만들고, 고른
   * 폴더는 있어야 한다 (D398). sessions/<session-id>/session.json을 쓰고 바로 띄운다. 세션 상한을 거치지 않는다 (D397).
   * 띄우지 못해도 세션은 남아 [열기]로 다시 연다
   */
  async createSession(cwd: string): Promise<CreateSessionResult> {
    const dir = cwd.trim() || this.defaultSessionDir()
    if (!path.isAbsolute(dir)) return { ok: false, error: `폴더는 절대 경로여야 함: ${dir}` }
    if (this.creatingSession) return { ok: false, error: '다른 세션을 만드는 중입니다' }
    this.creatingSession = true
    let runner: SessionRunner
    try {
      const home = path.join(this.o.home, 'home')
      if (path.resolve(dir) === path.resolve(home)) await fsp.mkdir(home, { recursive: true })
      const st = await fsp.stat(dir).catch(() => null)
      if (!st?.isDirectory()) return { ok: false, error: `폴더가 없음: ${dir}` }
      const at = this.at()
      const id = nextSessionId(at, [...this.sessions.keys(), ...(await sessionIds(this.o.home))])
      const record: SessionRecord = { id, cwd: path.resolve(dir), created_at: at }
      await saveSession(this.o.home, record)
      runner = this.sessionRunner(record)
      this.sessions.set(id, runner)
    } catch (e) {
      return { ok: false, error: `세션을 만들지 못함: ${String(e)}` }
    } finally {
      this.creatingSession = false
    }
    // 기록을 쓴 뒤로는 세션이 있다: 사이드바에 보이고, 아래가 실패해도 그 id와 까닭을 돌려준다 (I138)
    this.o.ui.sessions(this.sessionViews())
    const id = runner.record.id
    try {
      await runner.start()
    } catch (e) {
      return { ok: false, error: `Work 초안 폴더를 만들지 못함: ${String(e)}`, id }
    }
    const r = await runner.open(false)
    return r.ok ? { ok: true, id } : { ok: false, error: r.error, id }
  }

  /** 기본 세션의 명령을 부른다 */
  private withSession(
    id: string,
    fn: (runner: SessionRunner) => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const runner = this.sessions.get(id)
    return runner ? fn(runner) : Promise.resolve({ ok: false, error: '기본 세션이 없습니다' })
  }

  /** [열기]·[새 대화로 열기] (시나리오 12-6) */
  openSession(id: string, fresh: boolean): Promise<CommandResult> {
    return this.withSession(id, (s) => s.open(fresh))
  }

  /** [닫기] (시나리오 12-6) */
  closeSession(id: string): Promise<CommandResult> {
    return this.withSession(id, (s) => s.close())
  }

  /** 우클릭 [이름 바꾸기] (시나리오 12-7, D403) */
  renameSession(id: string, name: string): Promise<CommandResult> {
    return this.withSession(id, (s) => s.rename(name))
  }

  /** 우클릭 [지우기] (시나리오 12-7, D402): 끝난 세션만 */
  async deleteSession(id: string): Promise<CommandResult> {
    const r = await this.withSession(id, (s) => s.remove())
    if (r.ok) {
      this.sessions.delete(id)
      this.o.ui.sessions(this.sessionViews())
    }
    return r
  }

  /** 기본 세션과 Work의 초안을 다시 읽는다: 프로젝트 목록이 바뀌면 초안의 project가 맞는지 달라진다 */
  private refreshAllDrafts(): void {
    for (const session of this.sessions.values()) void session.refreshDrafts()
    for (const work of this.works.values()) void work.refreshDrafts()
  }

  /** 초안 카드의 [버리기] (D404, D421) */
  discardDraft(ref: DraftRef): Promise<CommandResult> {
    return this.removeDraft(ref)
  }

  /** 초안을 지운다: 만든 곳이 기본 세션이면 그 세션, Work면 그 Work의 초안 폴더다 (D421) */
  private removeDraft(ref: DraftRef): Promise<CommandResult> {
    return ref.source.kind === 'work'
      ? this.withWork(ref.source.id, (w) => w.removeDraft(ref.name))
      : this.withSession(ref.source.id, (s) => s.removeDraft(ref.name))
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

  /**
   * 터미널 키를 주인과 터미널 id로 나눈다: <project-id>/<work-id>/<task-id>는 Work, sessions/<session-id>/<id>는 기본
   * 세션이다. 프로젝트 id는 늘 -<해시>로 끝나 sessions와 겹치지 않는다
   */
  private terminal(key: string): { runner: TerminalOwner; taskId: string } | null {
    const i = key.lastIndexOf('/')
    if (i <= 0) return null
    const owner = key.slice(0, i)
    const runner: TerminalOwner | undefined = owner.startsWith('sessions/')
      ? this.sessions.get(owner.slice('sessions/'.length))
      : this.works.get(owner)
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

  /** 터미널에 보인 경로 글을 있는 파일이나 폴더로 푼다 (D411). 링크는 네트워크를 가리키지 않는지 보며 따라간다 (D412) */
  private async resolveLink(
    cwd: string,
    raw: string,
  ): Promise<{ path: string; real: string; st: Stats } | null> {
    const abs = linkPath(raw, cwd, os.homedir())
    if (!abs) return null
    const real = await realLinkPath(abs, LINK_FS)
    if (!real) return null
    const st = await fsp.stat(real).catch(() => null)
    return st ? { path: abs, real, st } : null
  }

  /**
   * 터미널 줄의 경로 낱말마다 시도할 글들 중 처음으로 있는 것의 번호, 없으면 null (D411). 마우스를 올릴 때마다
   * 부르므로 있는지만 본다
   */
  async terminalPaths(
    key: string,
    groups: readonly (readonly string[])[],
  ): Promise<(number | null)[]> {
    const t = this.terminal(key)
    if (!t) return groups.map(() => null)
    const cwd = t.runner.cwd(t.taskId)
    return Promise.all(
      groups.map(async (tries) => {
        for (const [i, raw] of tries.entries()) if (await this.resolveLink(cwd, raw)) return i
        return null
      }),
    )
  }

  /**
   * Ctrl+클릭한 경로를 어떻게 열지 (D411, D412). 안전한 형식(이름과 링크가 가리키는 것 모두)이면 실제 경로를 열고,
   * 아니면 그 자리를 폴더에서 보여 준다. 없거나 받지 않는 경로는 null이다
   */
  async terminalTarget(key: string, raw: string): Promise<{ path: string; open: boolean } | null> {
    const t = this.terminal(key)
    const found = t ? await this.resolveLink(t.runner.cwd(t.taskId), raw) : null
    if (!found) return null
    const { path: abs, real, st } = found
    const dir = st.isDirectory()
    const bit = (st.mode & 0o111) !== 0
    const open = opensSafely(abs, dir, bit) && opensSafely(real, dir, bit)
    return open ? { path: real, open } : { path: abs, open }
  }

  /**
   * 붙여넣은 그림을 `<RELAY_HOME>/pastes/`에 저장하고 경로를 돌려준다 (D410). 엔진은 붙여넣은 그림 경로를 읽어
   * 첨부한다. 저장할 때 오래된 것(PASTE_KEEP_MS)을 지운다
   */
  async savePaste(data: Uint8Array, ext: string): Promise<string> {
    const dir = path.join(this.o.home, 'pastes')
    await fsp.mkdir(dir, { recursive: true })
    const now = this.o.now ? this.o.now() : new Date()
    for (const name of await fsp.readdir(dir).catch(() => [])) {
      const file = path.join(dir, name)
      const st = await fsp.stat(file).catch(() => null)
      if (st?.isFile() && now.getTime() - st.mtimeMs > PASTE_KEEP_MS) {
        await fsp.rm(file, { force: true }).catch(() => undefined)
      }
    }
    const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
    const file = path.join(dir, `paste-${stamp}-${randomBytes(4).toString('hex')}.${ext}`)
    await fsp.writeFile(file, data, { flag: 'wx' })
    return file
  }
}

/** 서브모듈 프로젝트가 남아 메인 프로젝트의 [등록 해제]를 막는 까닭 (D417) */
function subProjectsBlock(subs: readonly ProjectState[]): string {
  const names = subs.map((p) => p.parent?.path ?? p.project_id).join(', ')
  return `서브모듈 프로젝트가 있음 (${names}). 서브모듈 프로젝트를 먼저 등록 해제하세요`
}
