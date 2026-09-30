import { kstWeek } from '../util/clock.js'
import { compareWarehouse, warehouseName } from '../warehouses/registry.js'
import { formatKst, formatNumber, renderTable } from './format.js'

/**
 * 주간 재고 리포트. 창고별 레코드를 그대로 보여 준다.
 * 가용 = 실재고 - 예약. 가용이 기준 이하이면 표시한다.
 */
export function buildStockRows({ stockTable, catalog, config }) {
  return stockTable
    .all()
    .sort((a, b) => a.sku.localeCompare(b.sku) || compareWarehouse(a.warehouse, b.warehouse))
    .map((r) => {
      const available = r.onHand - r.reserved
      return {
        sku: r.sku,
        name: catalog.find(r.sku)?.name ?? '(알 수 없음)',
        warehouse: r.warehouse,
        warehouseName: warehouseName(r.warehouse),
        onHand: r.onHand,
        reserved: r.reserved,
        available,
        low: available <= config.stock.lowThreshold,
      }
    })
}

export function summarize(rows) {
  return {
    skus: new Set(rows.map((r) => r.sku)).size,
    onHand: rows.reduce((s, r) => s + r.onHand, 0),
    reserved: rows.reduce((s, r) => s + r.reserved, 0),
    available: rows.reduce((s, r) => s + r.available, 0),
    low: rows.filter((r) => r.low).length,
  }
}

export function stockReport({ stockTable, catalog, clock, config }) {
  const now = clock.now()
  const period = kstWeek(now)
  const rows = buildStockRows({ stockTable, catalog, config })
  const summary = summarize(rows)
  const num = (v) => formatNumber(v)

  const table = renderTable(
    [
      { title: 'SKU', key: 'sku' },
      { title: '상품', key: 'name' },
      { title: '창고', key: 'warehouseName' },
      { title: '실재고', key: 'onHand', align: 'right', format: num },
      { title: '예약', key: 'reserved', align: 'right', format: num },
      { title: '가용', key: 'available', align: 'right', format: num },
      { title: '', key: 'low', format: (v) => (v ? config.reports.lowMark : '') },
    ],
    rows,
  )

  const text = [
    `주간 재고 리포트 (${period.label})`,
    `기준 시각: ${formatKst(now)}`,
    '',
    table,
    '',
    `SKU ${summary.skus}개, 실재고 ${num(summary.onHand)}, 예약 ${num(summary.reserved)}, 가용 ${num(summary.available)}, ${config.reports.lowMark} ${summary.low}건`,
  ].join('\n')

  return { period, rows, summary, text }
}
