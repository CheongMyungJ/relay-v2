// 작업 하나의 모양과 검사
import { nextId } from '../util/ids.js'

export const PRIORITIES = { high: 0, normal: 1, low: 2 }

/**
 * 작업을 만든다.
 * @param {object} spec
 * @param {string} spec.type 처리기 이름(report, cleanup, notify ...)
 * @param {object} [spec.payload]
 * @param {string} [spec.id] 없으면 job-N으로 매긴다
 * @param {'high'|'normal'|'low'} [spec.priority]
 * @param {string} [spec.dedupeKey] 같은 키의 작업은 큐에 하나만 둔다
 */
export function createJob(spec) {
  const job = {
    id: spec.id ?? nextId('job'),
    type: spec.type,
    payload: spec.payload ?? {},
    priority: spec.priority ?? 'normal',
    dedupeKey: spec.dedupeKey ?? null,
    createdAt: spec.createdAt ?? Date.now(),
  }
  validateJob(job)
  return job
}

/** 틀린 작업이면 던진다 */
export function validateJob(job) {
  if (!job || typeof job !== 'object') throw new TypeError('작업은 객체여야 합니다')
  if (typeof job.id !== 'string' || !job.id) throw new TypeError('작업 id는 빈 문자열이 아니어야 합니다')
  if (typeof job.type !== 'string' || !/^[a-z][a-z0-9-]*$/.test(job.type)) {
    throw new TypeError(`작업 종류가 틀렸습니다: ${job.type}`)
  }
  if (!(job.priority in PRIORITIES)) throw new TypeError(`우선순위가 틀렸습니다: ${job.priority}`)
  if (job.payload === null || typeof job.payload !== 'object') {
    throw new TypeError(`${job.id}: payload는 객체여야 합니다`)
  }
  return job
}

/** 로그에 남길 짧은 설명 */
export function describeJob(job) {
  return `${job.id}(${job.type})`
}
