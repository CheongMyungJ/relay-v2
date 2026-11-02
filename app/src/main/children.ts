// 자식 Work의 도구 (D543~D548). 자율 Work의 자율 진행 task가 task용 relay MCP(relay_task)로 부른 도구를 받아, 그 Work의
// 자식 Work를 만들고 진행한다. 바깥 호출자용 relay MCP(D516)와 도구는 다르고, 자식의 질문 답·승인·전달은 같은 처리
// (McpService의 answer, approve, deliver, revise, abandon)를 부모의 이름으로 부른다. Electron을 import하지 않는다
import {
  MAX_CHILDREN,
  childHandoff,
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
export const CHILD_TOOLS = ['spawn_child', 'list_children', 'answer_child', 'decide_child'] as const

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
  constructor(private readonly relay: Relay) {}

  /** 부모 task의 도구 호출 하나. 부모는 브리지를 띄운 task의 훅 토큰으로 정해진다(남의 Work를 부를 수 없다) */
  async call(
    parentKey: string,
    parentTaskId: string,
    tool: string,
    args: Args,
    signal?: AbortSignal,
  ): Promise<McpResult> {
    try {
      switch (tool) {
        case 'spawn_child':
          return await this.spawn(parentKey, parentTaskId, args)
        case 'list_children':
          return { ok: true, result: await this.summaries(parentKey) }
        case 'answer_child':
          return await this.relay.mcp.call('answer', {
            ...args,
            work: this.child(parentKey, args).key,
          })
        case 'decide_child':
          return await this.decide(parentKey, args, signal)
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

  /** 정하지 않은 자식 (D548): 끝나지 않은(완료, 포기, 보관이 아닌) 자식의 key */
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
        note: '자식의 기준은 부모 브랜치의 지금 커밋입니다. 커밋하지 않은 부모의 변경은 자식에 없습니다. 일하는 중인 자식에게는 ListAgents로 tree 폴더의 세션을 찾아 SendMessage로 말하세요',
      },
    }
  }

  /** 자식마다 지금 상태 (get_work의 모양에 브랜치, 기준 커밋, 맡는 파일, state_key를 더함) */
  private async summaries(parentKey: string) {
    const parentBase = this.relay.work(parentKey)?.work.base_commit
    const out = []
    for (const w of this.childrenOf(parentKey)) {
      const got = await this.relay.mcp.call('get_work', { work: w.key })
      const runner = this.relay.work(w.key)
      out.push({
        ...(got.ok ? (got.result as object) : { work: w.key, error: got.error }),
        branch: w.branch,
        tree: runner?.worktree ?? null,
        files: w.parent?.files ?? [],
        // 부모 브랜치의 변경 위에서 시작했는가: 그런 자식은 PR로 따로 낼 수 없다 (D547)
        on_parent_changes: runner ? runner.work.base_commit !== parentBase : null,
        state_key: stateKey(w),
      })
    }
    return out
  }

  /**
   * decide_child (D547): 마친 자식(Work 완료 화면)을 정한다. merge는 전달 없이 완료하고 부모가 자기 worktree에서 그 브랜치를
   * 합친다. pr은 따로 PR을 만든다(부모의 변경 위에서 시작한 자식은 막음). revise는 고칠 점과 함께 다시 열고, discard는 포기한다
   */
  private async decide(parentKey: string, args: Args, signal?: AbortSignal): Promise<McpResult> {
    const child = this.child(parentKey, args)
    const decision = text(args, 'decision') ?? ''
    // 자식 세션이 턴을 끝냈으면 정할 수 있다 (D555): 끝났는지는 자식이 부모에게 직접 말한다
    const atCompletion = () => {
      const task = currentTaskView(child)
      return child.status === 'active' && !!task && childTurnEnded(task.status)
    }
    const runner = this.relay.work(child.key)
    const busy = '자식 세션이 아직 일하는 중입니다. 자식이 끝났다고 말하면 정하세요'
    switch (decision) {
      case 'merge': {
        if (!atCompletion() || !runner) return { ok: false, error: busy }
        await runner.writeChildHandoff(childHandoff('merge'))
        const r = await this.relay.mcp.call('approve', { work: child.key })
        if (!r.ok) return r
        return {
          ok: true,
          result: {
            ok: true,
            branch: child.branch,
            next: `부모 worktree에서 \`git merge --no-ff ${child.branch}\`로 합치고, 충돌은 직접 풀고, 테스트를 다시 돌리세요`,
          },
        }
      }
      case 'pr': {
        if (!text(args, 'pr_title', false))
          throw new ArgError('pr에는 pr_title(PR 제목)이 필요합니다. 본문은 pr_body')
        if (!atCompletion()) return { ok: false, error: busy }
        const parent = this.relay.work(parentKey)?.work
        if (!parent || !runner) return { ok: false, error: 'Work가 없습니다' }
        if (runner.work.base_commit !== parent.base_commit)
          return {
            ok: false,
            error:
              '부모 브랜치의 변경 위에서 시작한 자식은 PR로 따로 내지 않습니다 (D547). merge로 부모에 합치세요',
          }
        const title = (text(args, 'pr_title') ?? '').replace(/\s+/g, ' ').trim()
        const body = text(args, 'pr_body', false) ?? ''
        // 따로 나가는 PR은 부모의 마지막 리뷰를 지나지 않으므로 앱이 먼저 독립 리뷰를 돌린다 (D554)
        const review = await runner.reviewChildForPr(signal)
        if (!review) return { ok: false, error: '자식의 지금 task가 없습니다' }
        const blocking = review.findings.filter((f) => f.severity === '차단')
        if (blocking.length)
          return {
            ok: false,
            error: `독립 리뷰에 차단 지적이 있어 PR을 만들지 않았습니다. 자식에게 고치게 한 뒤(SendMessage나 revise) 다시 pr로 정하세요: ${blocking
              .map((f) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.summary}`)
              .join('; ')}`,
          }
        const notes = review.findings.map(
          (f) => `- [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ''} — ${f.summary}`,
        )
        await runner.writeChildPr(
          [
            `# ${title}`,
            '',
            body.trim(),
            '',
            '## 독립 리뷰',
            notes.length ? notes.join('\n') : '- 지적 없음',
            '',
          ].join('\n'),
        )
        await runner.writeChildHandoff(childHandoff('pr'))
        return await this.relay.mcp.call('deliver', { work: child.key, choice: 'pr' })
      }
      case 'revise':
        return await this.relay.mcp.call('revise', {
          work: child.key,
          message: text(args, 'message') ?? '',
        })
      case 'discard':
        return await this.relay.mcp.call('abandon', { work: child.key })
      default:
        throw new ArgError('decision은 merge, pr, revise, discard 가운데 하나여야 합니다')
    }
  }
}
