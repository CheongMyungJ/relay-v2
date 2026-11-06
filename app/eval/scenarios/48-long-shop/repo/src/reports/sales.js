// 운영 보고: 하루 매출, 많이 팔린 상품, 분류별 매출. 주문 기준(결제한 주문, 취소한 수량 뺌)이다.
// 회계의 매출(송장과 전표)과는 다르다. 회계 숫자는 billing에서 본다.
import { formatWon } from '../orders/pricing.js'
import { kstDate } from '../shared/time.js'

const countable = (o) => o.status !== 'placed' && o.paidAmount > 0

function soldLines(order) {
  return order.lines
    .map((l) => ({ ...l, soldQty: l.qty - l.cancelledQty }))
    .filter((l) => l.soldQty > 0)
}

export function createSalesReports({ orders, catalog }) {
  /** 그날(한국 날짜) 결제한 주문의 상품 매출 */
  function dailySales(date) {
    const list = orders.listOrders().filter((o) => countable(o) && kstDate(paidAt(o)) === date)
    let items = 0
    let amount = 0
    for (const o of list) {
      for (const l of soldLines(o)) {
        items += l.soldQty
        amount += l.price * l.soldQty
      }
    }
    return { date, orders: list.length, items, amount }
  }

  /** 기간 [from, to)(한국 날짜)에 많이 팔린 상품 n개 */
  function topProducts(from, to, n = 5) {
    const bySku = new Map()
    for (const o of orders.listOrders().filter(countable)) {
      const day = kstDate(paidAt(o))
      if (day < from || day >= to) continue
      for (const l of soldLines(o)) {
        const row = bySku.get(l.sku) ?? { sku: l.sku, name: l.name, qty: 0, amount: 0 }
        row.qty += l.soldQty
        row.amount += l.price * l.soldQty
        bySku.set(l.sku, row)
      }
    }
    return [...bySku.values()].sort((a, b) => b.qty - a.qty || b.amount - a.amount).slice(0, n)
  }

  function salesByCategory(from, to) {
    const rows = new Map()
    for (const p of topProducts(from, to, Infinity)) {
      const category = catalog.find(p.sku)?.category ?? 'etc'
      rows.set(category, (rows.get(category) ?? 0) + p.amount)
    }
    return Object.fromEntries([...rows.entries()].sort((a, b) => b[1] - a[1]))
  }

  function dailyText(date) {
    const d = dailySales(date)
    return `${date} 주문 ${d.orders}건, 상품 ${d.items}개, ${formatWon(d.amount)}`
  }

  return { dailySales, topProducts, salesByCategory, dailyText }
}

function paidAt(order) {
  return order.history.find((h) => h.status === 'paid')?.at ?? order.createdAt
}
