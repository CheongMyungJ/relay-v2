// s3: 설계 결정 D8 — 연장은 기준 기한(baseDueOn)에서 14일을 이어 붙이고, 휴관일을 다시 따진다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkout, getLoan, renewLoan } from '../src/index.js'
import { book, setup } from './helpers.js'

test('휴관 때문에 미뤄진 날은 연장 기간에 쌓이지 않는다', () => {
  setup({ books: [book({ available: 1 })] })
  const l = checkout('M-1', 'B-1', '2026-09-25') // 기준 10-09(공휴일) → 실제 10-10
  assert.equal(l.dueOn, '2026-10-10')
  const r = renewLoan(l.id, '2026-10-06')
  assert.equal(r.baseDueOn, '2026-10-23')
  assert.equal(r.dueOn, '2026-10-23') // 10-10 + 14 = 10-24가 아니다
})

test('새 기준 기한이 휴관일이면 다시 다음 개관일로 미룬다', () => {
  setup({ books: [book({ available: 1 })] })
  const l = checkout('M-1', 'B-1', '2026-10-20') // 기준 11-03
  const r = renewLoan(l.id, '2026-10-28')
  assert.equal(r.baseDueOn, '2026-11-17') // 임시 휴관일
  assert.equal(r.dueOn, '2026-11-18')
})

test('미뤄진 기한이 연장에서 다시 미뤄지는 경우도 기준 기한부터', () => {
  setup({ books: [book({ available: 1 })] })
  const l = checkout('M-1', 'B-1', '2026-12-17') // 기준 12-31 → 실제 2027-01-02
  assert.equal(l.dueOn, '2027-01-02')
  const r = renewLoan(l.id, '2026-12-29')
  assert.equal(r.baseDueOn, '2027-01-14')
  assert.equal(r.dueOn, '2027-01-14') // 2027-01-02 + 14 = 01-16이 아니다
})

test('연장 결과는 저장된다', () => {
  setup({ books: [book({ available: 1 })] })
  const l = checkout('M-1', 'B-1', '2026-09-25')
  renewLoan(l.id, '2026-10-06')
  const saved = getLoan(l.id)
  assert.equal(saved.baseDueOn, '2026-10-23')
  assert.equal(saved.dueOn, '2026-10-23')
  assert.equal(saved.renewals, 1)
})
