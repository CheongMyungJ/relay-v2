// report 작업: 고객사의 한 달 사용 내역을 모아 보고서 요약을 만든다.

function round2(n) {
  return Math.round(n * 100) / 100
}

/** 금액이 큰 분류 n개 */
export function topCategories(rows, n) {
  const sums = new Map()
  for (const r of rows) sums.set(r.category, (sums.get(r.category) ?? 0) + r.amount)
  return [...sums.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
}

/**
 * @param {{ source: { query: (tenant: string, o?: object) => Promise<object[]> } }} deps
 */
export function createReportHandler({ source }) {
  return async function report(payload) {
    const { reportId, tenant, period } = payload
    if (!reportId || !tenant) throw new Error('report 작업에는 reportId와 tenant가 필요합니다')
    const rows = await source.query(tenant, { period })
    const total = rows.reduce((sum, r) => sum + r.amount, 0)
    return {
      reportId,
      tenant,
      period: period ?? null,
      rows: rows.length,
      total: round2(total),
      top: topCategories(rows, 3),
    }
  }
}
