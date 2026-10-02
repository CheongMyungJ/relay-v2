// 메모리 데이터 원천. 운영에서는 DB를 읽지만, 여기서는 행을 메모리에 두고 조회 지연만 흉내 낸다.
import { sleep } from '../clock.js'
import { jitter } from '../util/jitter.js'

/**
 * @param {object} [o]
 * @param {Record<string, object[]>} [o.data] 고객사(tenant)별 행: { date: 'YYYY-MM-DD', category, amount }
 * @param {{ baseMs?: number, perRowMs?: number, jitterMs?: number }} [o.latency] 조회 한 번에 걸리는 시간
 */
export function createMemorySource(o = {}) {
  const data = o.data ?? {}
  const { baseMs = 0, perRowMs = 0, jitterMs = 0 } = o.latency ?? {}
  let calls = 0

  return {
    /** 고객사의 행. period('2026-09')를 주면 그 달만 */
    async query(tenant, { period } = {}) {
      calls++
      if (!(tenant in data)) {
        const error = new Error(`알 수 없는 고객사: ${tenant}`)
        error.code = 'ENOTFOUND'
        throw error
      }
      const rows = period ? data[tenant].filter((r) => r.date.startsWith(period)) : data[tenant]
      await sleep(baseMs + Math.round(rows.length * perRowMs) + jitter(jitterMs))
      return rows.map((r) => ({ ...r }))
    },
    tenants() {
      return Object.keys(data)
    },
    get calls() {
      return calls
    },
  }
}

const CATEGORIES = ['food', 'travel', 'office', 'software', 'misc']

/** 시험과 예시에 쓸 결정적인 행 count개 */
export function sampleRows(count, { period = '2026-09', base = 1000 } = {}) {
  const rows = []
  for (let i = 0; i < count; i++) {
    rows.push({
      date: `${period}-${String((i % 28) + 1).padStart(2, '0')}`,
      category: CATEGORIES[i % CATEGORIES.length],
      amount: base + ((i * 37) % 500),
    })
  }
  return rows
}
