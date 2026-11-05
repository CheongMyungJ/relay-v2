// 재시도 대기열. 보낼 시각(notBefore)이 이른 것부터 꺼낸다.
import { createIdGenerator } from '../util/ids.js'

export class QueueFullError extends Error {
  constructor(size) {
    super(`재시도 대기열이 가득 참 (${size})`)
    this.name = 'QueueFullError'
  }
}

export function createRetryQueue({ maxSize = Infinity } = {}) {
  const nextId = createIdGenerator('retry')
  let jobs = []

  return {
    /** job: { event, delivery, attempt, notBefore, reason } */
    enqueue(job) {
      if (jobs.length >= maxSize) throw new QueueFullError(jobs.length)
      const stored = { ...job, id: nextId() }
      const at = jobs.findIndex((j) => j.notBefore > stored.notBefore)
      if (at === -1) jobs.push(stored)
      else jobs.splice(at, 0, stored)
      return stored
    },
    /** now까지 보낼 때가 된 일을 모두 꺼낸다 */
    takeDue(now) {
      const due = []
      while (jobs.length && jobs[0].notBefore <= now) due.push(jobs.shift())
      return due
    },
    nextDueAt: () => (jobs.length ? jobs[0].notBefore : null),
    /** 채널별 대기 수와 가장 오래 기다린 일 */
    stats(now) {
      const byChannel = {}
      for (const j of jobs) {
        const ch = j.delivery?.channel ?? '?'
        byChannel[ch] = (byChannel[ch] ?? 0) + 1
      }
      const overdue = jobs.filter((j) => j.notBefore <= now).length
      return { size: jobs.length, byChannel, overdue }
    },
    size: () => jobs.length,
    list: () => jobs.map((j) => ({ ...j })),
    /** 사용자가 탈퇴하는 등으로 보낼 필요가 없어진 일을 지운다 */
    removeWhere(pred) {
      const before = jobs.length
      jobs = jobs.filter((j) => !pred(j))
      return before - jobs.length
    },
  }
}
