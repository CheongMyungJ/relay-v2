import { test } from 'node:test'
import assert from 'node:assert'
import { parsePlan } from '../src/budget/plan.js'
import { normalizeVendor } from '../src/vendors/normalize.js'
import { splitGross, vatFor } from '../src/tax/rates.js'
import { canView, parseUsers } from '../src/users/permissions.js'
import { nextRun, parseSchedule } from '../src/schedule/next-run.js'
import { loadConfig } from '../src/config.js'
import { LruCache, memoize } from '../src/lib/cache.js'
import { composeMail } from '../src/notify/mail.js'
import { PeriodLock } from '../src/ledger/period-lock.js'
import { dropDuplicates, findDuplicates } from '../src/ledger/duplicates.js'
import { fromBankJson } from '../src/ledger/import-json.js'
import { filterRows } from '../src/ledger/filter.js'
import { toCsv } from '../src/format/csv-out.js'
import { toJson } from '../src/format/json-out.js'
import { row } from './helpers.js'

test('예산 계획 파일', () => {
  assert.deepStrictEqual(parsePlan('5110 = ₩500,000  # 소모품\n\n5200=1,000'), { 5110: '₩500,000', 5200: '1,000' })
  assert.throws(() => parsePlan('5110 = 1\n5110 = 2'), /두 번/)
  assert.throws(() => parsePlan('abc'), /=/)
})

test('거래처 이름 맞추기', () => {
  assert.strictEqual(normalizeVendor('(주)가나상사'), '가나상사')
  assert.strictEqual(normalizeVendor('주식회사  가나상사 '), '가나상사')
  assert.strictEqual(normalizeVendor('가나상사㈜'), '가나상사')
  assert.strictEqual(normalizeVendor(''), '(거래처 없음)')
})

test('부가세 계산', () => {
  assert.strictEqual(vatFor(12345), 1235)
  assert.strictEqual(vatFor(-12345), -1235)
  assert.deepStrictEqual(splitGross(11000), { supply: 10000, vat: 1000 })
})

test('권한', () => {
  assert.ok(canView({ role: 'admin' }, 'vat'))
  assert.ok(!canView({ role: 'viewer' }, 'vat'))
  assert.ok(!canView({ role: 'nobody' }, 'monthly'))
  assert.deepStrictEqual(parseUsers('김회계 accountant\n# x\n'), [{ name: '김회계', role: 'accountant' }])
})

test('일정', () => {
  assert.deepStrictEqual(parseSchedule('weekly:mon 08:30'), { kind: 'weekly', day: 1, hour: 8, minute: 30 })
  const from = new Date('2026-03-04T10:00:00Z')
  assert.strictEqual(nextRun('daily 07:00', from).toISOString(), '2026-03-05T07:00:00.000Z')
  assert.strictEqual(nextRun('monthly:1 09:00', from).toISOString(), '2026-04-01T09:00:00.000Z')
  assert.strictEqual(nextRun('weekly:mon 08:30', from).toISOString(), '2026-03-09T08:30:00.000Z')
})

test('설정', () => {
  assert.strictEqual(loadConfig({}).vatRate, 0.1)
  assert.strictEqual(loadConfig({ LEDGER_FISCAL_START: '4' }).fiscalYearStartMonth, 4)
  assert.throws(() => loadConfig({ LEDGER_FISCAL_START: '13' }), /LEDGER_FISCAL_START/)
  assert.throws(() => loadConfig({ LEDGER_OUTPUT: 'xml' }), /LEDGER_OUTPUT/)
})

test('캐시', () => {
  const c = new LruCache(2)
  c.set('a', 1).set('b', 2)
  c.get('a')
  c.set('c', 3)
  assert.ok(c.has('a') && !c.has('b'))
  let calls = 0
  const f = memoize((x) => ++calls + x)
  f(1)
  f(1)
  assert.strictEqual(calls, 1)
})

test('메일 본문', () => {
  const mail = composeMail({ to: 'a@b.co', report: 'vat', period: { year: 2026, quarter: 1 }, body: '본문\n' })
  assert.strictEqual(mail.subject, '[원장] 2026년 1분기 부가세')
  assert.throws(() => composeMail({ to: 'nope', report: 'vat', body: '' }), /메일 주소/)
})

test('마감된 달', () => {
  const lock = new PeriodLock(['2026-01'])
  assert.ok(lock.isClosed('2026-01-15'))
  assert.throws(() => lock.assertOpen([row('2026-01-02', 1010, '1')]), /2026-01/)
  assert.doesNotThrow(() => lock.assertOpen([row('2026-02-02', 1010, '1')]))
})

test('중복 의심 행', () => {
  const rows = [
    row('2026-01-02', 5110, '1,000', { vendor: '(주)가나' }),
    row('2026.01.02', 5110, '1,000', { vendor: '가나' }),
    row('2026-01-02', 5110, '2,000', { vendor: '가나' }),
  ]
  assert.deepStrictEqual(findDuplicates(rows).map((g) => g.indexes), [[0, 1]])
  assert.strictEqual(dropDuplicates(rows).length, 2)
})

test('은행 JSON을 원장 행으로', () => {
  const rows = fromBankJson([
    { tradedAt: '2026-03-02T10:00:00+09:00', amount: 1200000, direction: 'in', counterparty: '가나' },
    { tradedAt: '2026-03-03T10:00:00+09:00', amount: 5000, direction: 'out' },
  ])
  assert.strictEqual(rows[0].amount, '1,200,000')
  assert.strictEqual(rows[1].amount, '-5,000')
  assert.strictEqual(rows[1].date, '2026-03-03')
})

test('행 거르기', () => {
  const rows = [row('2026-01-02', 5110, '1', { category: '소모품' }), row('2026-02-02', 4010, '1')]
  assert.strictEqual(filterRows(rows, { types: ['expense'] }).length, 1)
  assert.strictEqual(filterRows(rows, { from: '2026-02-01' })[0].account, '4010')
  assert.strictEqual(filterRows(rows, { categories: ['소모품'], to: '2026-01-31' }).length, 1)
})

test('CSV와 JSON 출력', () => {
  assert.strictEqual(toCsv([{ a: '1,2', b: 'x"y' }]), 'a,b\n"1,2","x""y"\n')
  assert.strictEqual(toJson({ b: 1, a: new Map([['x', 2]]) }, { pretty: false }), '{"a":{"x":2},"b":1}\n')
})
