// 광고 대상 고르기. 최근 산 고객, 오래 안 산 고객, VIP, 지역.
import { fail } from '../shared/errors.js'
import { daysBetween } from '../shared/time.js'

const KINDS = ['recent', 'dormant', 'vip', 'region', 'all']

export function createSegments({ customers, orders, clock }) {
  function lastPaidAt(customerId) {
    const paid = orders
      .listOrders({ customerId })
      .filter((o) => o.paidAmount > 0)
      .map((o) => o.history.find((h) => h.status === 'paid')?.at)
      .filter(Boolean)
      .sort()
    return paid.at(-1) ?? null
  }

  /**
   * @param {{ kind: string, days?: number, region?: string }} rule
   * @returns {string[]} 고객 id
   */
  function select(rule) {
    if (!KINDS.includes(rule.kind)) fail('BAD_SEGMENT', `대상 종류: ${rule.kind}`)
    const now = clock.now()
    return customers
      .list()
      .filter((c) => {
        if (rule.kind === 'all') return true
        if (rule.kind === 'vip') return c.tier === 'vip'
        if (rule.kind === 'region') return c.region === rule.region
        const last = lastPaidAt(c.id)
        const days = rule.days ?? 30
        if (rule.kind === 'recent') return last !== null && daysBetween(last, now) <= days
        return last === null ? false : daysBetween(last, now) > days
      })
      .map((c) => c.id)
  }

  return { select, lastPaidAt }
}
