// 배치 요약: 개수, 걸린 시간, 실패 목록
import { groupByType } from './collector.js'

/** 정렬된 배열의 p 백분위수(0~100) */
export function percentile(sorted, p) {
  if (!sorted.length) return 0
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))]
}

function durations(records) {
  const ms = records.map((r) => r.durationMs).sort((a, b) => a - b)
  return {
    min: ms[0] ?? 0,
    p50: percentile(ms, 50),
    p95: percentile(ms, 95),
    max: ms[ms.length - 1] ?? 0,
  }
}

/**
 * @param {object[]} records collectResults의 결과
 * @param {{ batch: string, startedAt: number, finishedAt: number }} meta
 */
export function summarize(records, meta) {
  const done = records.filter((r) => r.status === 'done').length
  const byType = {}
  for (const [type, list] of Object.entries(groupByType(records))) {
    byType[type] = {
      total: list.length,
      failed: list.filter((r) => r.status === 'failed').length,
      durations: durations(list),
    }
  }
  return {
    batch: meta.batch,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
    durationMs: meta.finishedAt - meta.startedAt,
    counts: { total: records.length, done, failed: records.length - done },
    retried: records.filter((r) => r.attempts > 1).map((r) => r.jobId),
    failed: records.filter((r) => r.status === 'failed').map((r) => ({ jobId: r.jobId, error: r.error })),
    byType,
    records,
  }
}

/** 사람이 읽을 요약 몇 줄 */
export function formatSummary(summary) {
  const { counts } = summary
  const lines = [
    `${summary.batch}: ${counts.done}/${counts.total} 성공, ${counts.failed} 실패, ${summary.durationMs}ms`,
  ]
  for (const [type, t] of Object.entries(summary.byType)) {
    lines.push(`  ${type.padEnd(10)} ${t.total}개 (실패 ${t.failed}) p50 ${t.durations.p50}ms p95 ${t.durations.p95}ms`)
  }
  for (const f of summary.failed) lines.push(`  실패 ${f.jobId}: ${f.error?.message ?? '알 수 없음'}`)
  if (summary.retried.length) lines.push(`  재시도: ${summary.retried.join(', ')}`)
  return lines.join('\n')
}
