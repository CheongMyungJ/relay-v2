// 정해진 시각에 돌 작업 정의를 들고 있다가, 때가 된 것을 작업으로 만들어 준다.
import { createJob } from '../queue/job.js'
import { matches, parseCron } from './cron.js'

/**
 * @typedef {object} Definition
 * @property {string} name 정의 이름(겹치면 안 됨)
 * @property {string} cron
 * @property {(date: Date) => object | object[]} make createJob에 넘길 spec(여럿이면 배열)
 * @property {boolean} [enabled]
 */

export class Scheduler {
  constructor() {
    this.definitions = new Map()
    this.lastRun = new Map()
  }

  /** @param {Definition} def */
  define(def) {
    if (!def.name) throw new Error('정의에 name이 필요합니다')
    if (this.definitions.has(def.name)) throw new Error(`이미 있는 정의: ${def.name}`)
    if (typeof def.make !== 'function') throw new Error(`${def.name}: make 함수가 필요합니다`)
    this.definitions.set(def.name, { ...def, cron: parseCron(def.cron), enabled: def.enabled ?? true })
    return this
  }

  setEnabled(name, enabled) {
    const def = this.definitions.get(name)
    if (!def) throw new Error(`없는 정의: ${name}`)
    def.enabled = enabled
  }

  /** date(분 단위)에 돌 작업들. 같은 분에 두 번 부르면 두 번째는 비어 있다 */
  due(date) {
    const minute = Math.floor(date.getTime() / 60000)
    const jobs = []
    for (const def of this.definitions.values()) {
      if (!def.enabled || !matches(def.cron, date)) continue
      if (this.lastRun.get(def.name) === minute) continue
      this.lastRun.set(def.name, minute)
      for (const spec of [].concat(def.make(date))) {
        jobs.push(createJob({ dedupeKey: `${def.name}@${minute}`, ...spec }))
      }
    }
    return jobs
  }

  list() {
    return [...this.definitions.values()].map((d) => ({ name: d.name, cron: d.cron.source, enabled: d.enabled }))
  }
}
