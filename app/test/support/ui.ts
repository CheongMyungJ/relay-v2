// 시험의 가짜 화면 (I26). 창과 알림, 렌더러로 보내기 대신 받은 것을 모은다. [흐름]과 [실제]가 쓰고,
// [실제]의 앱 역할 프로세스(test/claude/app-process.mjs)도 쓰므로 __dirname 같은 CommonJS 값을 쓰지 않는다.
import type { Notice, UiPort } from '../../src/main/ports'
import type {
  ActivityUpdate,
  ActivityView,
  ProjectView,
  TerminalChunk,
  WorkView,
} from '../../src/shared/views'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 받은 스냅샷, 터미널 출력, 알림을 모은다 */
export class FakeUi implements UiPort {
  readonly works = new Map<string, WorkView>()
  /** Work마다 받은 스냅샷 전부 (되돌림 횟수 세기용) */
  readonly history: WorkView[] = []
  projectList: ProjectView[] = []
  readonly output = new Map<string, string>()
  readonly notices: Notice[] = []
  /** 도구 훅으로 따로 온 진행 표시 (D216). 받은 것 전부는 activityLog에 남는다 */
  readonly activities = new Map<string, ActivityView | null>()
  readonly activityLog: ActivityUpdate[] = []
  private readonly listeners = new Set<() => void>()

  work(view: WorkView): void {
    this.works.set(view.key, view)
    this.history.push(view)
    // 스냅샷의 진행 표시가 그 앞에 따로 온 것보다 새것이다 (렌더러와 같다, D216)
    for (const k of [...this.activities.keys()]) {
      if (k.startsWith(`${view.key}|`)) this.activities.delete(k)
    }
    this.wake()
  }

  activity(update: ActivityUpdate): void {
    this.activities.set(`${update.workKey}|${update.taskId}`, update.activity)
    this.activityLog.push(update)
    this.wake()
  }

  /** 렌더러가 보일 진행 표시: 스냅샷 뒤에 따로 온 것이 있으면 그것, 없으면 스냅샷의 값 */
  activityOf(workKey: string, taskId: string): ActivityView | null {
    const key = `${workKey}|${taskId}`
    if (this.activities.has(key)) return this.activities.get(key) ?? null
    return this.works.get(workKey)?.tasks.find((t) => t.id === taskId)?.activity ?? null
  }

  projects(views: ProjectView[]): void {
    this.projectList = views
    this.wake()
  }

  terminal(key: string, chunk: TerminalChunk): void {
    this.output.set(key, (this.output.get(key) ?? '') + chunk.data)
    this.wake()
  }

  notify(n: Notice): void {
    this.notices.push(n)
    this.wake()
  }

  /** 무엇이든 바뀌면 부른다. 돌려준 함수로 끊는다 */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private wake(): void {
    for (const cb of this.listeners) cb()
  }

  /** pred가 값을 돌려줄 때까지 기다린다. 기다리는 동안 tick을 부른다 */
  async until<T>(
    pred: () => T | null | undefined | false,
    label: string,
    timeoutMs = 60_000,
    tick?: () => unknown,
  ): Promise<T> {
    const end = Date.now() + timeoutMs
    for (;;) {
      const v = pred()
      if (v) return v
      if (Date.now() > end) throw new Error(`시간 초과: ${label}\n${this.dump()}`)
      await tick?.()
      await new Promise<void>((resolve) => {
        const off = this.onChange(() => {
          off()
          resolve()
        })
        setTimeout(() => {
          off()
          resolve()
        }, 250)
      })
    }
  }

  /** 실패했을 때 보일 상태: Work와 task 표시, 터미널 끝부분 */
  dump(): string {
    const lines: string[] = []
    for (const w of this.works.values()) {
      lines.push(`Work ${w.key}: ${w.statusLabel} ${w.stopNotice ?? ''}`)
      for (const p of w.problems) lines.push(`  문제: ${p}`)
      for (const t of w.tasks) {
        lines.push(`  ${t.label}: ${t.statusLabel}${t.live ? ' (세션)' : ''} ${t.error ?? ''}`)
        const tail = (this.output.get(t.terminal) ?? '').split(/\r?\n/).slice(-8).join('\n    ')
        if (tail.trim()) lines.push(`    ${tail}`)
      }
    }
    return lines.join('\n')
  }
}
