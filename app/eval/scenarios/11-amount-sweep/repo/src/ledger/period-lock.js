import { monthKey } from '../lib/dates.js'
import { LedgerError } from '../util/errors.js'

// 마감된 달. 마감된 달의 행을 새로 넣거나 고치려 하면 막는다
export class PeriodLock {
  constructor(closedMonths = []) {
    this.closed = new Set(closedMonths)
  }

  close(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new LedgerError(`달 형식은 YYYY-MM: ${month}`)
    this.closed.add(month)
  }

  reopen(month) {
    this.closed.delete(month)
  }

  isClosed(date) {
    const key = /^\d{4}-\d{2}$/.test(date) ? date : monthKey(date)
    return this.closed.has(key)
  }

  // rows 가운데 마감된 달에 든 행
  violations(rows) {
    return rows.filter((row) => this.isClosed(row.date))
  }

  assertOpen(rows) {
    const bad = this.violations(rows)
    if (bad.length) {
      const months = [...new Set(bad.map((r) => monthKey(r.date)))].sort()
      throw new LedgerError(`마감된 달의 행 ${bad.length}개: ${months.join(', ')}`, 'LOCKED')
    }
  }

  toJSON() {
    return [...this.closed].sort()
  }
}
