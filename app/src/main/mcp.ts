// relay MCP의 도구 호출을 Relay로 잇는다 (D516~D526). 브리지(scripts/relay-mcp.mjs)가 훅 서버의 /control로 보낸 호출을
// 받는다. 도구의 정의와 결과의 모양은 core/mcp이고, 여기는 값의 모양을 확인하고 Relay를 부른다. Electron을 import하지
// 않아 흐름 시험이 그대로 부른다. 앱 안의 세션이 부른 진행 도구는 거절한다 (D520)
import { driverBlock } from '../core/driver'
import {
  IN_APP_REFUSED,
  MCP_TOOLS,
  READ_TOOLS,
  WAIT_DEFAULT_SEC,
  WAIT_MAX_SEC,
  currentTaskView,
  finished,
  stateKey,
  workState,
  workSummary,
  type McpTool,
  type McpWork,
} from '../core/mcp'
import type { ControlRequest } from '../adapters/hooks'
import type { CommandResult, CustomTypeView, NewWorkInput, WorkView } from '../shared/views'
import { WORK_TYPES, type WorkType } from '../shared/work'
import type { WorkSettings } from '../shared/config'
import type { Relay } from './relay'

/** 도구 호출의 결과. 브리지가 MCP의 tools/call 결과(JSON 글, 실패면 isError)로 바꾼다 */
export type McpResult = { ok: true; result: unknown } | { ok: false; error: string }

/** 도구 인자의 모양이 틀렸다. 결과의 error로 돌려준다 */
class ArgError extends Error {}

type Args = Record<string, unknown>

function text(args: Args, key: string, required = true): string | undefined {
  const v = args[key]
  if (v === undefined || v === null || v === '') {
    if (required) throw new ArgError(`${key}가 필요합니다`)
    return undefined
  }
  if (typeof v !== 'string') throw new ArgError(`${key}는 문자열이어야 합니다`)
  return v
}

function flag(args: Args, key: string): boolean {
  const v = args[key]
  if (v === undefined || v === null) return false
  if (typeof v !== 'boolean') throw new ArgError(`${key}는 true/false여야 합니다`)
  return v
}

function oneOf<T extends string>(args: Args, key: string, values: readonly T[]): T | undefined {
  const v = text(args, key, false)
  if (v === undefined) return undefined
  if (!(values as readonly string[]).includes(v))
    throw new ArgError(`${key}는 ${values.join(', ')} 가운데 하나여야 합니다`)
  return v as T
}

function strings(args: Args, key: string): string[] | undefined {
  const v = args[key]
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || !v.every((s) => typeof s === 'string'))
    throw new ArgError(`${key}는 문자열 목록이어야 합니다`)
  return v as string[]
}

/** 유형 목록의 한 줄 (list_types) */
function typeLine(t: CustomTypeView) {
  return {
    id: t.id,
    source: t.source,
    name: t.name,
    description: t.description,
    steps: t.steps.map((s) => ({ id: s.id, title: s.title, auto_approve: s.autoApprove })),
    target: t.target,
    request_hint: t.requestHint,
    errors: t.errors,
    ...(t.shadowed ? { shadowed: true } : {}),
  }
}

function outcome(r: CommandResult): McpResult {
  return r.ok ? { ok: true, result: { ok: true } } : { ok: false, error: r.error }
}

export class McpService {
  private readonly waiters = new Set<(view: WorkView) => void>()

  constructor(
    private readonly relay: Relay,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Relay가 Work 스냅샷을 보낼 때마다 부른다. wait가 기다린다 */
  workChanged(view: WorkView): void {
    for (const w of [...this.waiters]) w(view)
  }

  tools(): readonly McpTool[] {
    return MCP_TOOLS
  }

  /** 훅 서버의 /control 처리 (D516): { tool, args }를 받아 결과를 돌려준다. tools/list는 tool이 없을 때다 */
  async handle(req: ControlRequest, signal: AbortSignal): Promise<unknown> {
    const tool = req.body['tool']
    if (tool === undefined) return { tools: this.tools() }
    if (typeof tool !== 'string') return { ok: false, error: 'tool이 문자열이 아닙니다' }
    const args = req.body['args']
    return this.call(
      tool,
      typeof args === 'object' && args !== null && !Array.isArray(args) ? (args as Args) : {},
      { inApp: req.inApp, signal },
    )
  }

  /** 도구 하나를 부른다. 앱 안의 세션은 조회만 한다 (D520) */
  async call(
    tool: string,
    args: Args,
    o: { inApp?: boolean; signal?: AbortSignal } = {},
  ): Promise<McpResult> {
    if (!MCP_TOOLS.some((t) => t.name === tool))
      return { ok: false, error: `모르는 relay 도구입니다: ${tool}` }
    if (o.inApp && !READ_TOOLS.includes(tool)) return { ok: false, error: IN_APP_REFUSED }
    try {
      return await this.run(tool, args, o.signal)
    } catch (e) {
      if (e instanceof ArgError) return { ok: false, error: e.message }
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  private async run(tool: string, args: Args, signal?: AbortSignal): Promise<McpResult> {
    switch (tool) {
      case 'list_projects':
        return {
          ok: true,
          result: this.relay.snapshot().projects.map((p) => ({
            id: p.id,
            name: p.name,
            path: p.repoPath,
            default_branch: p.defaultBranch,
            origin: p.origin,
            gh: p.gh,
            ...(p.parent ? { parent: p.parent.id } : {}),
          })),
        }
      case 'register_project':
        return this.register(args)
      case 'list_types':
        return this.types(args)
      case 'list_works':
        return this.works(args)
      case 'get_work':
        return { ok: true, result: await this.summary(this.view(args), flag(args, 'include_diff')) }
      case 'start_work':
        return this.start(args)
      case 'wait':
        return this.wait(args, signal)
      case 'answer':
        return this.answer(args)
      case 'approve': {
        const view = this.callerView(args)
        const task = this.current(view)
        return outcome(
          await this.relay.approve(view.key, task, {
            ...(flag(args, 'force') ? { force: true } : {}),
            by: 'caller',
          }),
        )
      }
      case 'revise': {
        const view = this.callerView(args)
        return outcome(
          await this.relay.revise(
            view.key,
            this.current(view),
            text(args, 'message') ?? '',
            'caller',
          ),
        )
      }
      case 'resume': {
        const view = this.callerView(args)
        if (view.status === 'stopped') return outcome(await this.relay.resumeWork(view.key))
        return outcome(await this.relay.resume(view.key, this.current(view)))
      }
      case 'deliver':
        return this.deliver(args)
      case 'pr_respond': {
        const view = this.callerView(args)
        if (!view.pr) return { ok: false, error: 'PR 진행인 Work가 아닙니다' }
        return outcome(
          await this.relay.prRespond(view.key, {
            items: strings(args, 'items') ?? view.pr.respond.items,
            instruction: text(args, 'instruction', false) ?? '',
          }),
        )
      }
      case 'abandon':
        return outcome(await this.relay.abandon(this.callerView(args).key))
      default:
        return { ok: false, error: `모르는 relay 도구입니다: ${tool}` }
    }
  }

  /** 인자의 Work. 없으면 던진다 */
  private view(args: Args): WorkView {
    const key = text(args, 'work') ?? ''
    const view = this.relay.work(key)?.view()
    if (!view) throw new ArgError(`Work가 없습니다: ${key}`)
    return view
  }

  /** 호출자가 진행하는 Work (D519). 사람이 진행하면 던진다 */
  private callerView(args: Args): WorkView {
    const view = this.view(args)
    const block = driverBlock({ driver: view.driver === 'caller' ? 'caller' : undefined }, 'caller')
    if (block) throw new ArgError(block)
    return view
  }

  /** 지금 task의 id. 없으면 던진다 */
  private current(view: WorkView): string {
    if (!view.current) throw new ArgError('지금 task가 없습니다')
    return view.current
  }

  private async summary(view: WorkView, includeDiff = false): Promise<McpWork> {
    const task = currentTaskView(view)
    const runner = this.relay.work(view.key)
    const record = task ? runner?.work.tasks.find((t) => t.id === task.id) : undefined
    const review = task ? await this.relay.review(view.key, task.id) : null
    return workSummary({
      view,
      review,
      taskDir: runner && record ? runner.files.taskDir(record) : null,
      includeDiff,
      nowMs: this.now(),
    })
  }

  private async register(args: Args): Promise<McpResult> {
    const inspection = await this.relay.inspectProject(text(args, 'path') ?? '')
    const checks = inspection.checks.map((c) => ({
      id: c.id,
      label: c.label,
      ok: c.ok,
      blocking: c.blocking,
      detail: c.detail,
    }))
    const branch = text(args, 'default_branch', false) ?? inspection.defaultBranch
    if (!inspection.canRegister || !branch)
      return {
        ok: false,
        error: `등록할 수 없습니다: ${
          checks
            .filter((c) => !c.ok && c.blocking)
            .map((c) => `${c.label} (${c.detail})`)
            .join(', ') || '기본 브랜치를 알 수 없음'
        }`,
      }
    const r = await this.relay.registerProject(inspection.path, branch)
    if (!r.ok) return r
    return { ok: true, result: { project: r.projectId, default_branch: branch, checks } }
  }

  private async types(args: Args): Promise<McpResult> {
    const project = text(args, 'project') ?? ''
    if (!this.relay.snapshot().projects.some((p) => p.id === project))
      return { ok: false, error: `프로젝트가 없습니다: ${project}` }
    const [list, custom] = await Promise.all([
      this.relay.customTypeList(),
      this.relay.customTypes(project),
    ])
    return { ok: true, result: [...list.builtin, ...custom].map(typeLine) }
  }

  private async works(args: Args): Promise<McpResult> {
    const project = text(args, 'project', false)
    const all = flag(args, 'include_finished')
    const views = this.relay
      .snapshot()
      .works.filter((w) => (!project || w.projectId === project) && (all || !finished(w)))
    return {
      ok: true,
      result: views.map((w) => ({
        work: w.key,
        title: w.title,
        type: w.customType?.id ?? w.type,
        driver: w.driver,
        status: w.status,
        state: workState(w),
        step: currentTaskView(w)?.label ?? null,
      })),
    }
  }

  private async start(args: Args): Promise<McpResult> {
    const projectId = text(args, 'project') ?? ''
    const project = this.relay.snapshot().projects.find((p) => p.id === projectId)
    if (!project) return { ok: false, error: `프로젝트가 없습니다: ${projectId}` }
    const typeId = text(args, 'type') ?? ''
    const builtin = (WORK_TYPES as readonly string[]).includes(typeId)
    const type: WorkType = builtin ? (typeId as WorkType) : 'custom'
    const settings = args['settings']
    if (settings !== undefined && (typeof settings !== 'object' || settings === null))
      throw new ArgError('settings는 객체여야 합니다')
    const target = text(args, 'target_branch', false)
    const input: NewWorkInput = {
      request: text(args, 'request') ?? '',
      type,
      ...(builtin ? {} : { customType: typeId }),
      baseBranch: text(args, 'base_branch', false) ?? project.defaultBranch,
      baseLocation: oneOf(args, 'base_location', ['local', 'remote'] as const) ?? 'local',
      ...(target ? { targetBranch: target } : {}),
      ...(settings ? { settings: settings as WorkSettings } : {}),
    }
    const driver = oneOf(args, 'driver', ['caller', 'human'] as const) ?? 'caller'
    const questions = oneOf(args, 'questions', ['return', 'recommend'] as const) ?? 'return'
    const r = await this.relay.createWork(projectId, input, {
      ...(driver === 'caller' ? { driver: 'caller' as const } : {}),
      ...(driver === 'caller' && questions === 'recommend'
        ? { callerQuestions: 'recommend' as const }
        : {}),
    })
    if (!r.ok) return r
    const view = this.relay.work(r.workKey)?.view()
    return { ok: true, result: view ? await this.summary(view) : { work: r.workKey } }
  }

  /**
   * 호출자가 움직일 일이 바뀔 때까지 기다린다 (D525). seen이 지금과 다르면 바로 돌려준다. 끊기면(브리지가 끝남) 기다림을
   * 그만둔다
   */
  private async wait(args: Args, signal?: AbortSignal): Promise<McpResult> {
    const start = this.view(args)
    const raw = args['timeout_sec']
    if (raw !== undefined && (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0))
      throw new ArgError('timeout_sec는 0 이상의 수여야 합니다')
    const seconds = Math.min(raw ?? WAIT_DEFAULT_SEC, WAIT_MAX_SEC)
    const seen = text(args, 'seen', false) ?? stateKey(start)
    if (stateKey(start) !== seen || finished(start))
      return { ok: true, result: { ...(await this.summary(start)), timed_out: false } }
    const changed = await new Promise<WorkView | null>((resolve) => {
      const done = (v: WorkView | null) => {
        this.waiters.delete(listener)
        clearTimeout(timer)
        signal?.removeEventListener('abort', aborted)
        resolve(v)
      }
      const listener = (v: WorkView) => {
        if (v.key === start.key && stateKey(v) !== seen) done(v)
      }
      const aborted = () => done(null)
      const timer = setTimeout(() => done(null), seconds * 1000)
      this.waiters.add(listener)
      signal?.addEventListener('abort', aborted, { once: true })
      if (signal?.aborted) done(null)
    })
    const view = this.relay.work(start.key)?.view() ?? changed ?? start
    return {
      ok: true,
      result: { ...(await this.summary(view)), timed_out: changed === null },
    }
  }

  private async answer(args: Args): Promise<McpResult> {
    const view = this.callerView(args)
    const task = currentTaskView(view)
    const id = text(args, 'question_id') ?? ''
    if (!task?.question || task.question.id !== id)
      return { ok: false, error: '이미 끝났거나 바뀐 질문입니다. get_work로 지금 질문을 보세요' }
    const answers = flag(args, 'cancel') ? null : (args['answers'] ?? {})
    return outcome(await this.relay.answerQuestion(view.key, task.id, id, answers, 'caller'))
  }

  private async deliver(args: Args): Promise<McpResult> {
    const view = this.callerView(args)
    const choice = oneOf(args, 'choice', ['push', 'pr'] as const)
    if (!choice) throw new ArgError('choice가 필요합니다 (push 또는 pr)')
    const raw = args['uncommitted']
    let uncommitted: { action: 'commit' | 'discard'; expect: string[] } | null = null
    if (raw !== undefined && raw !== null) {
      if (typeof raw !== 'object' || Array.isArray(raw))
        throw new ArgError('uncommitted는 객체여야 합니다')
      const u = raw as Args
      const action = oneOf(u, 'action', ['commit', 'discard'] as const)
      if (!action) throw new ArgError('uncommitted.action이 필요합니다')
      uncommitted = { action, expect: strings(u, 'expect') ?? [] }
    }
    if (view.repos?.length)
      return {
        ok: false,
        error:
          '여러 레포를 고친 Work의 전달은 레포마다 고릅니다. relay 앱의 Work 완료 화면에서 하세요',
      }
    const r = await this.relay.deliver(view.key, { choice, uncommitted }, 'caller')
    if (r.ok) return { ok: true, result: await this.summary(this.view(args)) }
    return r.uncommitted
      ? {
          ok: true,
          result: {
            ok: false,
            error: r.error,
            uncommitted: r.uncommitted,
            next: '이 목록을 uncommitted.expect로 주고 action(commit 또는 discard)을 골라 다시 부르세요',
          },
        }
      : { ok: false, error: r.error }
  }
}
