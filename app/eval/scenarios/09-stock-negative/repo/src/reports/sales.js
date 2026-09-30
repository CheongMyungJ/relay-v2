import { kstWeek } from '../util/clock.js'
import { formatWon } from '../pricing/price.js'
import { renderTable, formatNumber } from './format.js'

/**
 * 주간 매출 요약. 취소된 주문은 매출에서 빼고 취소율로만 센다.
 */
export function salesSummary({ orders, catalog, clock }) {
  const period = kstWeek(clock.now())
  const all = orders.list({ period })
  const counted = all.filter((o) => o.status !== 'cancelled')
  const cancelled = all.length - counted.length

  const byCategory = new Map()
  for (const order of counted) {
    for (const line of order.lines) {
      const category = catalog.find(line.sku)?.category ?? '기타'
      const acc = byCategory.get(category) ?? { category, units: 0, amount: 0 }
      acc.units += line.qty
      acc.amount += line.amount
      byCategory.set(category, acc)
    }
  }
  const categories = [...byCategory.values()].sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category))

  const revenue = counted.reduce((s, o) => s + o.total, 0)
  const cancelRate = all.length ? cancelled / all.length : 0

  const text = [
    `주간 매출 요약 (${period.label})`,
    `주문 ${all.length}건, 취소 ${cancelled}건 (${(cancelRate * 100).toFixed(1)}%), 매출 ${formatWon(revenue)}`,
    '',
    renderTable(
      [
        { title: '분류', key: 'category' },
        { title: '수량', key: 'units', align: 'right', format: formatNumber },
        { title: '금액', key: 'amount', align: 'right', format: formatWon },
      ],
      categories,
    ),
  ].join('\n')

  return { period, orders: all.length, cancelled, cancelRate, revenue, categories, text }
}
