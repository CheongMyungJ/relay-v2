// 사람 역할 (I29, 8.4). [흐름]과 [실제]가 함께 쓴다(8.1: claude 실행 파일만 바꾼다).
// 승인 대기면 [승인]하고(intake는 고른 size로 [의도 승인]), 질문 대기면 첫 선택지(Enter)로 답한다.
// 형식 오류가 끝까지 남으면 [오류 무시하고 승인]을 쓰고 센다. task마다 되돌림 횟수와 걸린 시간을 남긴다.
import type { Relay } from '../../src/main/relay'
import type { Size } from '../../src/shared/contracts'
import type { TaskView, WorkView } from '../../src/shared/views'
import type { FakeUi } from './harness'
import { sleep } from './harness'

export interface DriveOptions {
  /** 의도 승인 때 고를 size (D90). 없으면 초안의 size다 */
  size?: Size
  /** 형식 오류가 남은 대기에서 [오류 무시하고 승인]을 쓴다 */
  force?: boolean
  /** handoff 없이 턴이 끝났을 때 터미널에 보낼 말. 없으면 실패로 끝낸다 */
  nudge?: string
  maxNudges?: number
  /** 사람이 할 일을 기다리는 최대 시간 */
  stepTimeoutMs?: number
  /** 기다리는 동안 부른다. 첫 실행 창 수락 같은 일을 한다 ([실제]) */
  tick?: (task: TaskView) => unknown
}

export interface TaskOutcome {
  taskId: string
  label: string
  /** 형식 오류 되돌림 횟수 */
  bounces: number
  /** [오류 무시하고 승인]을 썼다 */
  forced: boolean
  /** 질문에 답한 횟수 */
  answers: number
  nudges: number
  /**
   * 걸린 시간. 앞 task의 [승인]이 끝난 때(첫 task는 drive를 시작한 때)부터 이 task의 [승인]이 끝난
   * 때까지다. [승인]에는 이 task의 세션 종료와 다음 task 시작이 들어 있다. 승인하지 못한 task는
   * drive가 끝난 때까지다. 구간이 겹치지 않아 합이 전체 시간을 넘지 않는다.
   */
  ms: number
}

export interface DriveResult {
  status: 'completed' | 'stopped' | 'failed'
  reason: string | null
  tasks: TaskOutcome[]
  ms: number
}

/** 사람이 움직여야 하는 상태 */
const HUMAN = new Set([
  'awaiting_approval',
  'asking',
  'input_needed',
  'idle',
  'blocked',
  'session_ended',
  'interrupted',
])

const current = (w: WorkView) => w.tasks.find((t) => t.id === w.current)

/** Work가 끝나거나 멈출 때까지 사람 역할을 한다 */
export async function drive(
  relay: Relay,
  ui: FakeUi,
  workKey: string,
  o: DriveOptions = {},
): Promise<DriveResult> {
  const started = Date.now()
  const outcomes = new Map<string, TaskOutcome & { approved: boolean }>()
  // 지금 task의 구간이 시작된 때. 다음 task는 승인 도중에 스냅샷에 나타나므로 그때가 아니라
  // 앞 task의 [승인]이 끝난 때부터 잰다
  let mark = started
  const seen = new Map<string, number>()
  // 스냅샷마다 연속 되돌림 횟수가 오르면 센다
  const off = ui.onChange(() => {
    const w = ui.works.get(workKey)
    for (const t of w?.tasks ?? []) {
      const out = outcome(t)
      const before = seen.get(t.id) ?? 0
      if (t.bounces > before) out.bounces += t.bounces - before
      seen.set(t.id, t.bounces)
    }
  })
  const outcome = (t: TaskView) => {
    let out = outcomes.get(t.id)
    if (!out) {
      out = {
        taskId: t.id,
        label: t.label,
        bounces: 0,
        forced: false,
        answers: 0,
        nudges: 0,
        ms: 0,
        approved: false,
      }
      outcomes.set(t.id, out)
    }
    return out
  }
  const finish = (status: DriveResult['status'], reason: string | null): DriveResult => {
    off()
    const now = Date.now()
    // 승인하지 못하고 끝난 지금 task는 drive가 끝난 때까지 잰다
    const w = ui.works.get(workKey)
    const last = w?.current ? outcomes.get(w.current) : undefined
    if (last && !last.approved) last.ms = now - mark
    return {
      status,
      reason,
      tasks: [...outcomes.values()].map((t) => ({
        taskId: t.taskId,
        label: t.label,
        bounces: t.bounces,
        forced: t.forced,
        answers: t.answers,
        nudges: t.nudges,
        ms: t.ms,
      })),
      ms: now - started,
    }
  }
  const timeout = o.stepTimeoutMs ?? 60_000

  try {
    for (;;) {
      const w = await ui.until(
        () => {
          const v = ui.works.get(workKey)
          if (!v) return null
          if (v.status !== 'active') return v
          const t = current(v)
          return t && HUMAN.has(t.status) ? v : null
        },
        `${workKey}: 사람이 할 일`,
        timeout,
        () => {
          const v = ui.works.get(workKey)
          const t = v && current(v)
          return t ? o.tick?.(t) : undefined
        },
      )
      if (w.status === 'completed') return finish('completed', null)
      if (w.status === 'stopped') return finish('stopped', w.stopNotice)
      const task = current(w)
      if (!task) return finish('failed', '지금 task가 없음')
      const out = outcome(task)

      switch (task.status) {
        case 'awaiting_approval':
        case 'idle': {
          const review = await relay.review(workKey, task.id)
          if (!review) return finish('failed', `${task.label}: 승인 화면을 읽지 못함`)
          const size =
            task.node === 'intake' ? (o.size ?? review.draftSize ?? undefined) : undefined
          const gate = review.gates[size ?? 'none']
          if (gate.approve || (gate.force && o.force)) {
            const forced = !gate.approve
            const r = await relay.approve(workKey, task.id, {
              ...(size ? { size } : {}),
              ...(forced ? { force: true } : {}),
            })
            if (!r.ok) {
              // 누른 사이에 파일이 바뀌었을 수 있다. 다음 상태를 다시 본다
              await sleep(500)
              continue
            }
            out.forced = forced
            out.approved = true
            const now = Date.now()
            out.ms = now - mark
            mark = now
            // 다음 task가 시작되거나 Work가 끝날 때까지 기다린다
            await ui.until(
              () => {
                const v = ui.works.get(workKey)
                return v && (v.current !== task.id || v.status !== 'active') ? v : null
              },
              `${task.label} 승인 뒤`,
              timeout,
            )
            continue
          }
          if (task.status === 'awaiting_approval') {
            return finish(
              'failed',
              `${task.label}: 승인할 수 없음 (${review.errors.map((e) => e.message).join('; ')})`,
            )
          }
          if (o.nudge && out.nudges < (o.maxNudges ?? 2)) {
            out.nudges++
            relay.terminalWrite(task.terminal, o.nudge)
            await sleep(300)
            relay.terminalWrite(task.terminal, '\r')
            await ui.until(
              () => ui.works.get(workKey)?.tasks.find((t) => t.id === task.id)?.status !== 'idle',
              `${task.label}: 재촉 뒤`,
              timeout,
            )
            continue
          }
          const why = review.handoffPresent
            ? `형식 오류: ${review.errors.map((e) => `${e.file}: ${e.message}`).join('; ')}`
            : 'handoff 없이 턴이 끝남'
          return finish('failed', `${task.label}: ${why}`)
        }
        case 'asking':
        case 'input_needed': {
          // 첫 선택지(추천)로 답한다. 여러 질문이면 Enter를 여러 번 누른다 (S2)
          for (let i = 0; i < 10; i++) {
            relay.terminalWrite(task.terminal, '\r')
            out.answers++
            const moved = await ui
              .until(
                () =>
                  ui.works.get(workKey)?.tasks.find((t) => t.id === task.id)?.status !==
                  task.status,
                `${task.label}: 답한 뒤`,
                3_000,
              )
              .then(() => true)
              .catch(() => false)
            if (moved) break
          }
          continue
        }
        case 'blocked':
          return finish('failed', `${task.label}: 막힘`)
        case 'session_ended':
          return finish('failed', `${task.label}: handoff 없이 세션이 끝남`)
        case 'interrupted':
          return finish('failed', `${task.label}: 시작하지 못함 (${task.error ?? ''})`)
        default:
          return finish('failed', `${task.label}: 모르는 상태 ${task.status}`)
      }
    }
  } catch (e) {
    return finish('failed', e instanceof Error ? e.message : String(e))
  }
}
