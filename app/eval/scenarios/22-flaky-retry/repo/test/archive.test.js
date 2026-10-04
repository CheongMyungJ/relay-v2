import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert'
import { resetNow, resetSleep, setNow, setSleep } from '../src/clock.js'
import { createReportHandler } from '../src/handlers/report.js'
import { createMemorySource, sampleRows } from '../src/sources/memory-source.js'
import { createFileStore } from '../src/store/file-store.js'
import { listReports, loadReport, reportPath, saveReport, strayTemps } from '../src/store/report-archive.js'
import { stamp } from '../src/util/ids.js'

let t
beforeEach(() => {
  t = Date.UTC(2026, 9, 1, 2, 0)
  setNow(() => t)
  setSleep(async (ms) => {
    t += ms
  })
})
afterEach(() => {
  resetSleep()
  resetNow()
})

const report = (n, tenant = `t-${n}`) => ({ reportId: `report-${n}`, tenant, period: '2026-09', total: n * 100 })

test('보관소: 쓰기, 읽기, 이름 바꾸기, 목록', async () => {
  const files = createFileStore({ latency: { baseMs: 3 } })
  await files.writeFile('a/x.txt', 'hello')
  assert.strictEqual(await files.readFile('a/x.txt'), 'hello')
  await files.rename('a/x.txt', 'a/y.txt')
  assert.deepStrictEqual(files.list('a/'), ['a/y.txt'])
  await assert.rejects(files.readFile('a/x.txt'), (e) => e.code === 'ENOENT')
  await assert.rejects(files.rename('a/x.txt', 'a/z.txt'), (e) => e.code === 'ENOENT')
  assert.ok(files.exists('a/y.txt'))
  assert.strictEqual(await files.remove('a/y.txt'), true)
  assert.deepStrictEqual(files.list(), [])
})

test('보관소: 경로 검사', async () => {
  const files = createFileStore()
  await assert.rejects(files.writeFile('/etc/x', 'a'), /경로/)
  await assert.rejects(files.writeFile('a/../b', 'a'), /경로/)
  await assert.rejects(files.writeFile('a', 1), /문자열/)
})

test('보관소: 쓰는 도중에는 앞부분만 보인다', async () => {
  const files = createFileStore({ latency: { baseMs: 5 } })
  const writing = files.writeFile('r.json', 'abcdefgh')
  assert.strictEqual(await files.readFile('r.json'), 'abcd')
  await writing
  assert.strictEqual(await files.readFile('r.json'), 'abcdefgh')
})

test('보고서 보관: 저장하고 다시 읽는다, 임시 파일은 남지 않는다', async () => {
  const files = createFileStore({ latency: { baseMs: 2, perKbMs: 1 } })
  const path = await saveReport(files, report(1, 'acme'))
  assert.strictEqual(path, 'reports/2026-09/report-1.json')
  assert.deepStrictEqual(await loadReport(files, '2026-09', 'report-1'), report(1, 'acme'))
  assert.deepStrictEqual(strayTemps(files, '2026-09'), [])
})

test('보고서 보관: 다시 저장하면 새 내용으로 바뀐다', async () => {
  const files = createFileStore({ latency: { baseMs: 2 } })
  await saveReport(files, report(1, 'acme'))
  await saveReport(files, { ...report(1, 'acme'), total: 999 })
  assert.strictEqual((await loadReport(files, '2026-09', 'report-1')).total, 999)
  assert.deepStrictEqual(listReports(files, '2026-09'), ['reports/2026-09/report-1.json'])
})

test('보고서 보관: 여러 개를 차례로', async () => {
  const files = createFileStore({ latency: { baseMs: 1 } })
  for (const n of [3, 1, 2]) await saveReport(files, report(n))
  assert.deepStrictEqual(listReports(files, '2026-09'), [1, 2, 3].map((n) => reportPath('2026-09', `report-${n}`)))
  for (const n of [1, 2, 3]) assert.strictEqual((await loadReport(files, '2026-09', `report-${n}`)).tenant, `t-${n}`)
  assert.strictEqual(files.stats.renames, 3)
})

test('기간이 없으면 no-period 폴더', () => {
  assert.strictEqual(reportPath(null, 'r-1'), 'reports/no-period/r-1.json')
  assert.throws(() => reportPath('2026-09'), /reportId/)
})

test('report 처리기: 보관소를 주면 보관하고 경로를 돌려준다', async () => {
  const source = createMemorySource({ data: { acme: sampleRows(5) }, latency: { baseMs: 3 } })
  const files = createFileStore({ latency: { baseMs: 2 } })
  const out = await createReportHandler({ source, archive: files })({ reportId: 'report-1', tenant: 'acme', period: '2026-09' })
  assert.strictEqual(out.archived, 'reports/2026-09/report-1.json')
  const saved = await loadReport(files, '2026-09', 'report-1')
  assert.strictEqual(saved.total, out.total)
  assert.strictEqual(saved.archived, undefined)
})

test('짧은 꼬리표', () => {
  assert.strictEqual(stamp(1759197304120), 'mg5wnj94')
  assert.strictEqual(stamp(35.9), 'z')
})
