// 밤마다 도는 보고서 배치: 처리기 묶음과 작업 목록 만들기
import { createCleanupHandler } from './handlers/cleanup.js'
import { createNotifyHandler } from './handlers/notify.js'
import { createReportHandler } from './handlers/report.js'
import { createJob } from './queue/job.js'

/**
 * 가진 의존성에 맞는 처리기만 만든다.
 * @param {{ source?: object, store?: object, mailer?: object }} deps
 */
export function createHandlers(deps = {}) {
  const handlers = {}
  if (deps.source) handlers.report = createReportHandler(deps)
  if (deps.store) handlers.cleanup = createCleanupHandler(deps)
  if (deps.mailer) handlers.notify = createNotifyHandler(deps)
  return handlers
}

/**
 * 고객사마다 report 작업 하나, 끝에 알림 작업 하나.
 * @param {string[]} tenants
 * @param {{ period: string, notify?: string[] }} o
 */
export function nightlyJobs(tenants, { period, notify = [] }) {
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`기간은 YYYY-MM 형식이어야 합니다: ${period}`)
  const jobs = tenants.map((tenant, i) =>
    createJob({
      id: `job-${i + 1}`,
      type: 'report',
      payload: { reportId: `report-${i + 1}`, tenant, period },
    }),
  )
  if (notify.length) {
    jobs.push(
      createJob({
        id: `job-${jobs.length + 1}`,
        type: 'notify',
        priority: 'low',
        payload: { to: notify, subject: `${period} 보고서 ${tenants.length}건 생성` },
      }),
    )
  }
  return jobs
}

/** 기록 목록에서 report 작업의 결과만 reportId → 결과로 */
export function reportsById(records) {
  const out = {}
  for (const r of records) {
    if (r.type === 'report' && r.status === 'done') out[r.output.reportId] = { jobId: r.jobId, ...r.output }
  }
  return out
}
