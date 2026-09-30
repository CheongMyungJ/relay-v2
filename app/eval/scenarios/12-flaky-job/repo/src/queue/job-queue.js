// 작업 큐. 우선순위(high → normal → low) 순서로 꺼내고, 같은 우선순위 안에서는 넣은 순서를 지킨다.
import { PRIORITIES, validateJob } from './job.js'

export class JobQueue {
  constructor() {
    this.lanes = Object.keys(PRIORITIES)
      .sort((a, b) => PRIORITIES[a] - PRIORITIES[b])
      .map((name) => ({ name, items: [] }))
    this.keys = new Set()
    this.ids = new Set()
  }

  get size() {
    return this.lanes.reduce((n, lane) => n + lane.items.length, 0)
  }

  isEmpty() {
    return this.size === 0
  }

  /** 작업을 넣는다. 같은 dedupeKey가 이미 있으면 넣지 않고 false */
  enqueue(job) {
    validateJob(job)
    if (this.ids.has(job.id)) throw new Error(`같은 id의 작업이 이미 큐에 있습니다: ${job.id}`)
    if (job.dedupeKey && this.keys.has(job.dedupeKey)) return false
    this.lane(job.priority).items.push(job)
    this.ids.add(job.id)
    if (job.dedupeKey) this.keys.add(job.dedupeKey)
    return true
  }

  enqueueAll(jobs) {
    return jobs.filter((job) => this.enqueue(job)).length
  }

  /** 가장 앞의 작업 하나를 꺼낸다 */
  dequeue() {
    for (const lane of this.lanes) {
      if (lane.items.length) return this.forget(lane.items.shift())
    }
    return undefined
  }

  /** 최대 n개를 꺼낸다 */
  take(n) {
    const out = []
    while (out.length < n && !this.isEmpty()) out.push(this.dequeue())
    return out
  }

  /** 모두 꺼낸다 */
  drain() {
    return this.take(this.size)
  }

  /** 꺼내지 않고 앞의 작업을 본다 */
  peek() {
    for (const lane of this.lanes) if (lane.items.length) return lane.items[0]
    return undefined
  }

  /** 조건에 맞는 작업을 뺀다. 뺀 개수를 돌려준다 */
  remove(predicate) {
    let removed = 0
    for (const lane of this.lanes) {
      const keep = []
      for (const job of lane.items) {
        if (predicate(job)) {
          this.forget(job)
          removed++
        } else {
          keep.push(job)
        }
      }
      lane.items = keep
    }
    return removed
  }

  /** 종류별 개수 */
  countByType() {
    const counts = {}
    for (const lane of this.lanes) for (const job of lane.items) counts[job.type] = (counts[job.type] ?? 0) + 1
    return counts
  }

  lane(priority) {
    return this.lanes.find((l) => l.name === priority)
  }

  forget(job) {
    this.ids.delete(job.id)
    if (job.dedupeKey) this.keys.delete(job.dedupeKey)
    return job
  }
}
