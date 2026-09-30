// 실행 결과(outcome)를 작업과 짝지어 기록(record)으로 만든다.

/** 오류를 기록에 남길 수 있는 모양으로 */
export function serializeError(error) {
  if (!error) return null
  if (typeof error !== 'object') return { name: 'Error', message: String(error) }
  return {
    name: error.name ?? 'Error',
    message: error.message ?? String(error),
    code: error.code ?? null,
  }
}

/** 작업 하나와 그 결과로 기록 하나 */
export function toRecord(job, outcome) {
  return {
    jobId: job.id,
    type: job.type,
    status: outcome.ok ? 'done' : 'failed',
    output: outcome.ok ? (outcome.value ?? null) : null,
    error: outcome.ok ? null : serializeError(outcome.error),
    attempts: outcome.attempts,
    durationMs: outcome.durationMs,
  }
}

/**
 * 작업 목록과 실행 결과를 짝지어 기록 목록을 만든다.
 * @param {object[]} jobs runBatch에 넘긴 작업 목록
 * @param {object[]} outcomes runPool이 돌려준 결과
 */
export function collectResults(jobs, outcomes) {
  if (outcomes.length !== jobs.length) {
    throw new Error(`결과 수(${outcomes.length})가 작업 수(${jobs.length})와 다릅니다`)
  }
  return jobs.map((job, i) => toRecord(job, outcomes[i]))
}

/** jobId → 기록 */
export function indexRecords(records) {
  const map = new Map()
  for (const r of records) map.set(r.jobId, r)
  return map
}

/** 종류별로 묶는다 */
export function groupByType(records) {
  const groups = {}
  for (const r of records) (groups[r.type] ??= []).push(r)
  return groups
}
