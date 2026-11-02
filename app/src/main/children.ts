// 자식 Work의 도구 (D543~D546, D556). 자율 Work의 자율 진행 task가 task용 relay MCP(relay_task)로 부른 도구를 받아, 그 Work의
// 자식 Work를 만든다. 합치기, PR, 언제 끝낼지는 두 세션이 정하고, 앱은 부모 브랜치에 합쳐진 자식을 닫기만 한다(D556). 바깥
// 호출자용 relay MCP(D516)와 도구는 다르고, 자식의 질문 답과 닫기는 같은 처리(McpService의 answer, approve)를 부모의 이름으로
// 부른다. Electron을 import하지 않는다
import { headCommit, isAncestor } from '../adapters/git'
import {
  MAX_CHILDREN,
  childHandoff,
  childMerged,
  childOverlap,
  childTurnEnded,
  isOpenChild,
} from '../core/children'
import { currentTaskView, stateKey } from '../core/mcp'
import { workBranch } from '../core/records'
import type { WorkView } from '../shared/views'
import type { McpResult } from './mcp'
import type { Relay } from './relay'

type Args = Record<string, unknown>

/** 자식 도구의 이름 (D544). 브리지(scripts/codex-bridge.mjs)의 도구 정의와 같다 */
export const CHILD_TOOLS = ['spawn_child', 'list_children', 'answer_child'] as const

class ArgError extends Error {}

function text(args: Args, key: string, required = true): string | undefined {
  const v = args[key]
  if (v === undefined || v === null || v === '') {
    if (required) throw new ArgError(`${key}가 필요합니다`)
    return undefined
  }
  if (typeof v !== 'string') throw new ArgError(`${key}는 문자열이어야 합니다`)
  return v
}

function strings(args: Args, key: string): string[] {
  const v = args[key]
  if (v === undefined || v === null) return []
  if (!Array.isArray(v) || !v.every((s) => typeof s === 'string'))
    throw new ArgError(`${key}는 문자열 목록이어야 합니다`)
  return v as string[]
}

export class ChildService {
  constructor(
    private readonly relay: Relay,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  /** 부모 task의 도구 호출 하나. 부모는 브리지를 띄운 task의 훅 토큰으로 정해진다(남의 Work를 부를 수 없다) */
  async call(
    parentKey: string,
    parentTaskId: string,
    tool: string,
    args: Args,
  ): Promise<McpResult> {
    try {
      switch (tool) {
        case 'spawn_child':
          return await this.spawn(parentKey, parentTaskId, args)
        case 'list_children':
          await this.closeMerged(parentKey)
          return { ok: true, result: await this.summaries(parentKey) }
        case 'answer_child':
          return await this.relay.mcp.call('answer', {
            ...args,
            work: this.child(parentKey, args).key,
          })
        default:
          return { ok: false, error: `모르는 자식 도구입니다: ${tool}` }
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  /** 부모 Work의 자식들 (만든 차례) */
  childrenOf(parentKey: string): WorkView[] {
    const parent = this.relay.work(parentKey)
    if (!parent) return []
    return this.relay
      .snapshot()
      .works.filter((w) => w.parent?.key === parentKey)
      .sort((a, b) => a.key.localeCompare(b.key))
  }

  /**
   * 부모 브랜치에 합쳐진 자식을 닫는다 (D556): 턴을 끝낸 자식의 브랜치 끝이 부모 worktree의 HEAD에 담겼으면 기록용 handoff를
   * 쓰고 승인해 전달 없이 완료한다. 부모가 턴을 끝낼 때와 list_children 때 부른다. 실패한 자식은 건너뛴다
   */
  async closeMerged(parentKey: string): Promise<void> {
    const parent = this.relay.work(parentKey)
    if (!parent) return
    const env = { env: this.env }
    for (const view of this.childrenOf(parentKey)) {
      if (view.status !== 'active') continue
      const runner = this.relay.work(view.key)
      const task = currentTaskView(view)
      if (!runner || !task) continue
      try {
        const head = await headCommit(runner.worktree, env)
        const merged = childMerged({
          turnEnded: childTurnEnded(task.status),
          head,
          base: runner.work.base_commit,
          inParent: await isAncestor(parent.worktree, head, 'HEAD', env),
        })
        if (!merged) continue
        await runner.writeChildHandoff(childHandoff())
        await this.relay.mcp.call('approve', { work: view.key })
      } catch {
        // 자식 하나를 읽지 못해도 다른 자식은 본다
      }
    }
  }

  /** 끝나지 않은 자식의 key (D561) */
  openChildren(parentKey: string): string[] {
    return this.childrenOf(parentKey)
      .filter((w) => isOpenChild(w.status))
      .map((w) => w.key)
  }

  /** 인자의 자식. 이 부모의 자식이 아니면 던진다 */
  private child(parentKey: string, args: Args): WorkView {
    const key = text(args, 'work') ?? ''
    const view = this.childrenOf(parentKey).find((w) => w.key === key)
    if (!view) throw new ArgError(`이 Work의 자식이 아닙니다: ${key}`)
    return view
  }

  /** spawn_child (D544, D545): 부모가 쓴 의도로 자식 Work를 만든다 */
  private async spawn(parentKey: string, parentTaskId: string, args: Args): Promise<McpResult> {
    const parent = this.relay.work(parentKey)
    if (!parent) return { ok: false, error: '부모 Work가 없습니다' }
    const work = parent.work
    if (work.type !== 'auto') return { ok: false, error: '자식 Work는 자율 Work만 만듭니다' }
    if (work.parent)
      return { ok: false, error: '자식 Work는 자식을 만들지 않습니다 (깊이 1, D545)' }
    const task = work.tasks.find((t) => t.id === parentTaskId)
    if (!task || task.node !== 'orchestrate' || task.status !== 'working')
      return { ok: false, error: '일하는 중인 자율 진행에서만 자식을 만듭니다' }
    const all = this.childrenOf(parentKey).filter((w) => w.status !== 'abandoned')
    if (all.length >= MAX_CHILDREN)
      return {
        ok: false,
        error: `이 Work의 자식은 ${MAX_CHILDREN}개까지입니다 (D545). 남은 일은 직접 하세요`,
      }
    const title = (text(args, 'title') ?? '').replace(/\s+/g, ' ').trim()
    // 부모의 지시는 자유 글이다 (D552): 형식을 보지 않는다
    const brief = (text(args, 'brief') ?? '').trim()
    const files = strings(args, 'files')
    const branch = workBranch(work)
    const target = work.target_branch ?? work.base_branch
    const r = await this.relay.createWork(
      parent.project.project_id,
      {
        request: `${title}\n\n${brief}\n${files.length ? `\n맡는 파일: ${files.join(', ')}\n` : ''}`,
        type: 'auto',
        baseBranch: branch,
        baseLocation: 'local',
        targetBranch: target,
      },
      {
        parent: { workId: work.work_id, taskId: parentTaskId, intent: brief, files },
      },
    )
    if (!r.ok) return r
    const overlap = childOverlap(
      files,
      this.childrenOf(parentKey)
        .filter((w) => w.key !== r.workKey && isOpenChild(w.status))
        .map((w) => ({ work: w.key, files: w.parent?.files ?? [] })),
    )
    const child = this.relay.work(r.workKey)
    const view = child?.view()
    return {
      ok: true,
      result: {
        work: r.workKey,
        branch: view?.branch ?? null,
        // 자식 세션이 일하는 폴더: ListAgents에서 이 폴더의 세션에 SendMessage로 말한다 (D553)
        tree: child?.worktree ?? null,
        ...(overlap.length
          ? {
              warning: `나란히 도는 자식과 맡는 파일이 겹침: ${overlap.map((o) => `${o.work}(${o.files.join(', ')})`).join('; ')}. 합칠 때 충돌할 수 있습니다`,
            }
          : {}),
        note: '자식의 기준은 부모 브랜치의 지금 커밋입니다(커밋하지 않은 변경은 없음). 자식과는 ListAgents로 tree 폴더의 세션을 찾아 SendMessage로 말합니다',
      },
    }
  }

  /** 자식마다 지금 상태 (get_work의 모양에 브랜치, worktree, 맡는 파일, state_key를 더함) */
  private async summaries(parentKey: string) {
    const out = []
    for (const w of this.childrenOf(parentKey)) {
      const got = await this.relay.mcp.call('get_work', { work: w.key })
      const runner = this.relay.work(w.key)
      out.push({
        ...(got.ok ? (got.result as object) : { work: w.key, error: got.error }),
        branch: w.branch,
        tree: runner?.worktree ?? null,
        files: w.parent?.files ?? [],
        state_key: stateKey(w),
      })
    }
    return out
  }
}
