import { listTools } from '../catalog/tools.js'
import { addDays, daysInMonth, parseDate } from '../util/dates.js'

/** 한 달 동안 공구마다 대여된 날의 비율(0~1). 반납 안 된 대여는 그 달 끝까지 센다 */
export function utilization(rentals, month) {
  const total = daysInMonth(month)
  const first = `${month}-01`
  const last = addDays(first, total - 1)
  const out = {}
  for (const t of listTools()) out[t.id] = 0
  for (const r of rentals) {
    const from = Math.max(parseDate(r.startDate), parseDate(first))
    const end = r.returnedOn ?? last
    const to = Math.min(parseDate(end), parseDate(last))
    if (to < from) continue
    const days = Math.round((to - from) / 86400000) + 1
    out[r.toolId] = (out[r.toolId] ?? 0) + days
  }
  for (const id of Object.keys(out)) out[id] = Math.min(1, out[id] / total)
  return out
}
