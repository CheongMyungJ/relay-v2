// report 작업: 고객사의 한 달 사용 내역을 모아 보고서 요약을 만든다. 보관소를 주면 보고서를 보관한다.
import { saveReport } from '../store/report-archive.js'

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
 * @param {object} deps
 * @param {{ query: (tenant: string, o?: object) => Promise<object[]> }} deps.source
 * @param {object} [deps.archive] 보관소(store/file-store.js). 없으면 보관하지 않는다
 */
export function createReportHandler({ source, archive }) {
  return async function report(payload) {
    const { reportId, tenant, period } = payload
    if (!reportId || !tenant) throw new Error('report 작업에는 reportId와 tenant가 필요합니다')
    const rows = await source.query(tenant, { period })
    const total = rows.reduce((sum, r) => sum + r.amount, 0)
    const out = {
      reportId,
      tenant,
      period: period ?? null,
      rows: rows.length,
      total: round2(total),
      top: topCategories(rows, 3),
    }
    if (archive) return { ...out, archived: await saveReport(archive, out) }
    return out
  }
}
