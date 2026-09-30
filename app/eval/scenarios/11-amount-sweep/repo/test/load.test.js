import { test } from 'node:test'
import assert from 'node:assert'
import { loadLedger, summarizeLedger } from '../src/ledger/load.js'
import { setLevel } from '../src/log.js'

const CSV = `일자,계정,분류,거래처,적요,금액,부가세
2026-01-05,4010,매출,가나상사,1월 매출,"3,000,000","300,000"
# 주석 줄

2026.01.08,5110,소모품,다라문구,사무용품,"₩120,000",
`

test('한글 머리줄 원장을 읽고 금액은 글자 그대로 둔다', () => {
  const rows = loadLedger(CSV)
  assert.strictEqual(rows.length, 2)
  assert.deepStrictEqual(rows[0], {
    date: '2026-01-05',
    account: '4010',
    category: '매출',
    vendor: '가나상사',
    memo: '1월 매출',
    amount: '3,000,000',
    vat: '300,000',
  })
  assert.strictEqual(rows[1].amount, '₩120,000')
})

test('영문 머리줄, 없는 칸은 빈 글자', () => {
  const rows = loadLedger('date,account,amount\n2026-02-01,1020,500\n')
  assert.deepStrictEqual(rows, [
    { date: '2026-02-01', account: '1020', category: '', vendor: '', memo: '', amount: '500', vat: '' },
  ])
})

test('잘못된 행: strict면 오류, 아니면 건너뜀', () => {
  const text = 'date,account,amount\n2026-13-01,1020,500\n2026-02-01,1020,700\n'
  assert.throws(() => loadLedger(text), /2번째 줄/)
  setLevel('silent')
  try {
    assert.strictEqual(loadLedger(text, { strict: false }).length, 1)
  } finally {
    setLevel('info')
  }
})

test('필수 칸이 없으면 오류', () => {
  assert.throws(() => loadLedger('date,account\n2026-01-01,1010\n'), /amount/)
})

test('원장 개요', () => {
  const info = summarizeLedger(loadLedger(CSV))
  assert.strictEqual(info.rows, 2)
  assert.strictEqual(info.from, '2026-01-05')
  assert.strictEqual(info.to, '2026-01-08')
  assert.deepStrictEqual(info.perAccount, { 4010: 1, 5110: 1 })
})
