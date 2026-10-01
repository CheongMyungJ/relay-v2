import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { parseCsv } from '../src/csv.js'
import { summarize } from '../src/summary.js'
import { formatReport } from '../src/format.js'
import { buildReport } from '../src/report.js'

test('읽기, 집계, 출력이 세 모듈로 나뉘고 buildReport는 차례로 부른다', () => {
  const csv = 'date,category,amount\n2026-09-01,food,12000\n2026-09-02,taxi,8000\n'
  assert.strictEqual(formatReport(summarize(parseCsv(csv))), buildReport(csv))
  const report = fs.readFileSync(new URL('../src/report.js', import.meta.url), 'utf8')
  assert.doesNotMatch(report, /split\(|padEnd|new Map/, 'report.js에 읽기·집계·출력 코드가 남아 있음')
})
