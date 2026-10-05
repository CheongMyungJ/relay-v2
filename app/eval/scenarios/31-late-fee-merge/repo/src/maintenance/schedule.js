import { listTools } from '../catalog/tools.js'
import { addDays, daysBetween } from '../util/dates.js'

// 공구 점검 주기(일). 전동 공구는 자주 본다
const INTERVAL = { power: 30, garden: 45, ladder: 90, hand: 120 }

const lastChecked = new Map()

export function recordCheck(toolId, on, note = '') {
  lastChecked.set(toolId, { on, note })
}

export function lastCheck(toolId) {
  return lastChecked.get(toolId) ?? null
}

/** today 기준 점검할 때가 된 공구. 한 번도 점검하지 않은 공구도 넣는다 */
export function dueForCheck(today) {
  const out = []
  for (const t of listTools()) {
    const last = lastChecked.get(t.id)
    const interval = INTERVAL[t.category] ?? 60
    if (!last) {
      out.push({ toolId: t.id, name: t.name, due: today, overdueDays: 0 })
      continue
    }
    const due = addDays(last.on, interval)
    const overdueDays = daysBetween(due, today)
    if (overdueDays >= 0) out.push({ toolId: t.id, name: t.name, due, overdueDays })
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays || a.toolId.localeCompare(b.toolId))
}

export function resetChecks() {
  lastChecked.clear()
}
