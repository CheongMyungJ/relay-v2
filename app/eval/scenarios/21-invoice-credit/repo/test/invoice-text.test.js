import { test } from 'node:test'
import assert from 'node:assert'
import { renderInvoice } from '../src/format/invoice-text.js'
import { createInvoice, issueInvoice } from '../src/invoice/invoice.js'

const nuri = { name: '누리테크 주식회사', bizNo: '1058711900' }

function issued() {
  const draft = createInvoice({
    customerId: 'C-0388',
    lines: [
      { name: 'A4 복사용지 박스', unitPrice: 27630, qty: 3 },
      { name: '커피믹스 100입', unitPrice: 13470, qty: 2, discount: { amount: 1940 } },
      { name: '실무 핸드북', unitPrice: 18000, qty: 1, taxType: 'exempt' },
    ],
    memo: '9월 정기 납품',
  })
  return issueInvoice(draft, { number: 'INV-2044', issueDate: '2026-09-21', dueDate: '2026-11-05' })
}

test('발행된 청구서 서식', () => {
  const expected = [
    '================================================',
    '                    청 구 서',
    '================================================',
    '청구서 번호   INV-2044',
    '발행일        2026년 9월 21일',
    '납부 기한     2026년 11월 5일',
    '공급자        한빛오피스 주식회사 (120-81-47521)',
    '공급받는자    누리테크 주식회사 (105-87-11900)',
    '------------------------------------------------',
    '품목                수량       단가         금액',
    '------------------------------------------------',
    'A4 복사용지 박스       3     27,630       82,890',
    '커피믹스 100입         2     13,470       26,940',
    '  할인 1,940원                            -1,940',
    '실무 핸드북(면세)      1     18,000       18,000',
    '------------------------------------------------',
    '공급가액                                 125,890',
    '  면세분                                  18,000',
    '부가세                                    10,789',
    '합계                                     136,679',
    '================================================',
    '금 십삼만육천육백칠십구원정',
    '비고: 9월 정기 납품',
    '입금 계좌: 국민은행 841-21-0412-339 한빛오피스(주)',
  ].join('\n')
  assert.strictEqual(renderInvoice(issued(), { customer: nuri }), expected)
})

test('초안은 번호 없이, 고객이 없으면 고객 ID를 찍는다', () => {
  const text = renderInvoice(createInvoice({ customerId: 'C-0412', lines: [{ name: '가위', unitPrice: 2780, qty: 5 }] }))
  const lines = text.split('\n')
  assert.strictEqual(lines[1], '                청 구 서 (초안)')
  assert.strictEqual(lines[3], '청구서 번호   (미발행)')
  assert.ok(lines.includes('공급받는자    C-0412'))
  assert.ok(!lines.some((l) => l.startsWith('발행일')))
})

test('영세율 청구서 표시', () => {
  const inv = createInvoice({ customerId: 'C-0520', zeroRated: true, lines: [{ name: '토너 (흑)', unitPrice: 48000, qty: 2 }] })
  const text = renderInvoice(inv)
  assert.match(text, /\n부가세\(영세율\) +0\n/)
  assert.match(text, /\n합계 +96,000\n/)
})

test('모든 줄이 서식 폭을 넘지 않는다', () => {
  const text = renderInvoice(issued(), { customer: nuri })
  for (const line of text.split('\n').slice(0, 21)) assert.ok([...line].length <= 48, line)
})
