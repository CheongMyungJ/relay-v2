// 배치 실행기. 작업 목록을 받아 병렬로 돌리고, 결과를 모아 요약을 돌려준다.
import { now } from '../clock.js'
import { collectResults } from '../collect/collector.js'
import { summarize } from '../collect/summary.js'
import { loadConfig } from '../config.js'
import { createLogger } from '../log/logger.js'
import { createMetrics } from '../metrics.js'
import { validateJob } from '../queue/job.js'
import { batchId } from '../util/ids.js'
import { executeJob } from './execute.js'
import { runPool } from './pool.js'

/**
 * @param {object} options
 * @param {Record<string, (payload: object, ctx: object) => Promise<any>>} options.handlers 작업 종류별 처리기
 * @param {number} [options.concurrency] 동시에 돌릴 작업 수 (기본 4)
 * @param {number} [options.timeoutMs]
 * @param {object} [options.retry] { attempts, backoffMs, factor, maxBackoffMs }
 * @param {object} [options.logger]
 * @param {object} [options.metrics]
 * @param {object} [options.history] 배치 기록 저장소(store/history.js)
 * @param {object} [options.context] 처리기에 함께 넘길 값
 * @param {object} [options.env] 설정을 읽을 환경 변수 (기본 process.env)
 */
export function createRunner(options = {}) {
  if (!options.handlers || typeof options.handlers !== 'object') {
    throw new TypeError('handlers가 필요합니다')
  }
  const config = loadConfig(
    { concurrency: options.concurrency, timeoutMs: options.timeoutMs, retry: options.retry, log: options.log },
    options.env,
  )
  const handlers = { ...options.handlers }
  const logger = options.logger ?? createLogger({ level: config.log.level, scope: 'runner' })
  const metrics = options.metrics ?? createMetrics()
  const history = options.history ?? null

  /** 작업 목록 하나를 돌린다. 기록(records)은 작업 목록과 같은 순서다 */
  async function runBatch(jobs, { batch } = {}) {
    jobs.forEach(validateJob)
    const id = batch ?? batchId(new Date(now()))
    const startedAt = now()
    logger.info('배치 시작', { batch: id, jobs: jobs.length, concurrency: config.concurrency })

    const outcomes = await runPool(
      jobs,
      (job) =>
        executeJob(job, {
          handlers,
          retry: config.retry,
          timeoutMs: config.timeoutMs,
          logger,
          context: options.context ?? {},
        }),
      {
        concurrency: config.concurrency,
        onChunk: (p) => logger.debug('묶음 끝', p),
      },
    )

    const records = collectResults(jobs, outcomes)
    for (const r of records) {
      metrics.increment(`jobs.${r.status}`)
      metrics.observe(`jobs.${r.type}.ms`, r.durationMs)
    }
    const summary = summarize(records, { batch: id, startedAt, finishedAt: now() })
    history?.add(summary)
    logger.info('배치 끝', { batch: id, done: summary.counts.done, failed: summary.counts.failed })
    return summary
  }

  /** 큐를 비울 때까지 꺼내 한 배치로 돌린다 */
  async function runQueue(queue, opts) {
    return runBatch(queue.drain(), opts)
  }

  return { config, metrics, runBatch, runQueue }
}
