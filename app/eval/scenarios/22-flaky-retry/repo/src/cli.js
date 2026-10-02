#!/usr/bin/env node
// 예시 배치를 한 번 돌려 요약을 찍는다: node src/cli.js [기간] [고객사 수]
import { formatSummary } from './collect/summary.js'
import { createOutbox } from './handlers/notify.js'
import { createHandlers, nightlyJobs } from './nightly.js'
import { createRunner } from './runner/runner.js'
import { createMemorySource, sampleRows } from './sources/memory-source.js'
import { createFileStore } from './store/file-store.js'
import { listReports } from './store/report-archive.js'

async function main(argv) {
  const period = argv[0] ?? '2026-09'
  const count = Number(argv[1] ?? 6)
  if (!Number.isInteger(count) || count < 1) throw new Error(`고객사 수가 틀렸습니다: ${argv[1]}`)

  const data = {}
  for (let i = 1; i <= count; i++) data[`tenant-${i}`] = sampleRows(10 * i, { period })
  const source = createMemorySource({ data, latency: { baseMs: 5, perRowMs: 0.2, jitterMs: 5 } })
  const outbox = createOutbox()
  const archive = createFileStore({ latency: { baseMs: 2, perKbMs: 1, jitterMs: 2 } })
  const runner = createRunner({ handlers: createHandlers({ source, archive, mailer: outbox }) })

  const jobs = nightlyJobs(Object.keys(data), { period, notify: ['ops@example.com'] })
  const summary = await runner.runBatch(jobs)
  console.log(formatSummary(summary))
  for (const r of summary.records) {
    if (r.type === 'report' && r.output) console.log(`  ${r.jobId} → ${r.output.reportId} ${r.output.tenant} ${r.output.total}`)
  }
  console.log(`  보관: ${listReports(archive, period).length}개`)
  return summary.counts.failed === 0 ? 0 : 1
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(e.message)
    process.exit(2)
  },
)
