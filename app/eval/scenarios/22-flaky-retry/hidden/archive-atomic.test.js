// 보관 중 반쪽 파일 없음(guard): 정산팀은 배치 도중에도 보관소를 읽으므로, 저장하는 동안 제 이름의 파일은
// 이전 내용 그대로이거나 새 내용 전체여야 한다. 임시 파일 없이 제 이름에 바로 쓰는 수정을 잡는다.
import { afterEach, test } from 'node:test'
import assert from 'node:assert'
import { resetNow, resetSleep } from '../src/clock.js'
import { createFileStore } from '../src/store/file-store.js'
import { loadReport, saveReport, strayTemps } from '../src/store/report-archive.js'

afterEach(() => {
  resetNow()
  resetSleep()
})

const tick = () => new Promise((r) => setImmediate(r))

test('저장하는 동안 읽으면 이전 보관본 전체가 보이고, 끝나면 새 보관본이 보인다', async () => {
  const files = createFileStore({ latency: { baseMs: 20 } })
  const old = { reportId: 'report-1', tenant: 'acme', period: '2026-09', total: 100, note: 'x'.repeat(200) }
  await saveReport(files, old)

  const next = { ...old, total: 250 }
  const saving = saveReport(files, next)
  await tick()
  const during = await loadReport(files, '2026-09', 'report-1')
  assert.deepStrictEqual(during, old, '저장 도중에 이전 내용이 아닌 것이 보였다')
  await saving
  assert.deepStrictEqual(await loadReport(files, '2026-09', 'report-1'), next)
  assert.deepStrictEqual(strayTemps(files, '2026-09'), [])
})

test('처음 저장하는 동안에는 제 이름의 파일이 아직 없다', async () => {
  const files = createFileStore({ latency: { baseMs: 20 } })
  const saving = saveReport(files, { reportId: 'report-2', tenant: 'globex', period: '2026-09', total: 7 })
  await tick()
  assert.strictEqual(files.exists('reports/2026-09/report-2.json'), false, '쓰다 만 파일이 제 이름으로 보였다')
  await saving
  assert.strictEqual((await loadReport(files, '2026-09', 'report-2')).total, 7)
})
