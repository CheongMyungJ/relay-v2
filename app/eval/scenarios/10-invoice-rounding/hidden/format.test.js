import { test } from 'node:test'
import assert from 'node:assert'
import { invoicesToCsv } from '../src/export/invoices-csv.js'
import { renderInvoice } from '../src/format/invoice-text.js'
import { formatNumber, formatWon, wonInWords } from '../src/format/won.js'
import { createInvoice, invoiceTotals, issueInvoice } from '../src/invoice/invoice.js'
import { computeTotals } from '../src/invoice/total.js'

// 지키기: 부가세가 없는 청구서, 이미 발행된 청구서, 서식 출력은 그대로여야 한다

const HEADER_RULE = '================================================'

test('금액 서식', () => {
  assert.strictEqual(formatNumber(1234567), '1,234,567')
  assert.strictEqual(formatWon(29082), '29,082원')
  assert.strictEqual(formatWon(-1940), '-1,940원')
  assert.strictEqual(wonInWords(37699), '금 삼만칠천육백구십구원정')
})

test('영세율 청구서: 부가세 0, 서식 그대로', () => {
  const draft = createInvoice({
    customerId: 'C-0520',
    zeroRated: true,
    lines: [
      { sku: 'OF-1675', name: '수정테이프', unitPrice: 1675, qty: 9 },
      { sku: 'EL-1237', name: '전선 몰드 1m', unitPrice: 1237, qty: 4 },
      { sku: 'OF-7365', name: 'A4 라벨지', unitPrice: 7365, qty: 3, discount: { percent: 20 } },
    ],
  })
  assert.deepStrictEqual(computeTotals(draft), {
    subtotal: 42118,
    discount: 4419,
    supply: 37699,
    taxable: 37699,
    exempt: 0,
    vat: 0,
    total: 37699,
  })
  const issued = issueInvoice(draft, { number: 'INV-2045', issueDate: '2026-09-22', dueDate: '2026-10-07' })
  const text = renderInvoice(issued, { customer: { name: 'Pacific Trade Co., Ltd.', bizNo: '6178103459' } })
  assert.deepStrictEqual(text.split('\n'), [
    HEADER_RULE,
    '                    청 구 서',
    HEADER_RULE,
    '청구서 번호   INV-2045',
    '발행일        2026년 9월 22일',
    '납부 기한     2026년 10월 7일',
    '공급자        한빛오피스 주식회사 (120-81-47521)',
    '공급받는자    Pacific Trade Co., Ltd. (617-81-03459)',
    '------------------------------------------------',
    '품목                수량       단가         금액',
    '------------------------------------------------',
    '수정테이프             9      1,675       15,075',
    '전선 몰드 1m           4      1,237        4,948',
    'A4 라벨지              3      7,365       22,095',
    '  할인 20%                                -4,419',
    '------------------------------------------------',
    '공급가액                                  37,699',
    '부가세(영세율)                                 0',
    '합계                                      37,699',
    HEADER_RULE,
    '금 삼만칠천육백구십구원정',
    '입금 계좌: 국민은행 841-21-0412-339 한빛오피스(주)',
  ])
})

test('면세 품목만 있는 청구서: 부가세 0', () => {
  const inv = createInvoice({
    customerId: 'C-0412',
    lines: [
      { sku: 'BK-1680', name: '세무 실무 가이드', unitPrice: 16800, qty: 3, taxType: 'exempt', discount: { amount: 1285 } },
      { sku: 'BK-2250', name: '회계 원리', unitPrice: 22500, qty: 1, taxType: 'exempt' },
    ],
  })
  assert.deepStrictEqual(computeTotals(inv), {
    subtotal: 72900,
    discount: 1285,
    supply: 71615,
    taxable: 0,
    exempt: 71615,
    vat: 0,
    total: 71615,
  })
})

// 8월에 발행해 합계가 저장된 청구서. 저장된 합계를 다시 계산하지 않는다
const INV_1987 = {
  number: 'INV-1987',
  customerId: 'C-0412',
  issueDate: '2026-08-12',
  dueDate: '2026-09-11',
  zeroRated: false,
  memo: '',
  status: 'issued',
  lines: [
    { sku: 'OF-1342', name: '박스테이프', unitPrice: 1342, qty: 4, taxType: 'taxable' },
    { sku: 'OF-0905', name: '네임펜 흑', unitPrice: 905, qty: 7, taxType: 'taxable' },
    { sku: 'OF-1085', name: '스테이플러 심', unitPrice: 1085, qty: 3, taxType: 'taxable' },
    { sku: 'OF-1675', name: '수정테이프', unitPrice: 1675, qty: 5, taxType: 'taxable' },
    { sku: 'OF-0345', name: '볼펜 0.5 흑', unitPrice: 345, qty: 9, taxType: 'taxable' },
  ],
  totals: { subtotal: 26438, discount: 0, supply: 26438, taxable: 26438, exempt: 0, vat: 2644, total: 29082 },
}

test('발행된 청구서는 저장된 합계 그대로', () => {
  assert.strictEqual(invoiceTotals(INV_1987).total, 29082)
  const text = renderInvoice(INV_1987, { customer: { name: '(주)세림건축', bizNo: '2148612341' } })
  assert.deepStrictEqual(text.split('\n').slice(9, 22), [
    '품목                수량       단가         금액',
    '------------------------------------------------',
    '박스테이프             4      1,342        5,368',
    '네임펜 흑              7        905        6,335',
    '스테이플러 심          3      1,085        3,255',
    '수정테이프             5      1,675        8,375',
    '볼펜 0.5 흑            9        345        3,105',
    '------------------------------------------------',
    '공급가액                                  26,438',
    '부가세                                     2,644',
    '합계                                      29,082',
    HEADER_RULE,
    '금 이만구천팔십이원정',
  ])
  const csv = invoicesToCsv([INV_1987], { bom: false })
  assert.strictEqual(csv.split('\r\n')[1], 'INV-1987,2026-08-12,C-0412,,26438,2644,29082,발행')
})

test('과세 청구서 서식 그대로', () => {
  const issued = issueInvoice(
    createInvoice({
      customerId: 'C-0388',
      lines: [
        { name: 'A4 복사용지 박스', unitPrice: 27630, qty: 3 },
        { name: '커피믹스 100입', unitPrice: 13470, qty: 2, discount: { amount: 1940 } },
        { name: '실무 핸드북', unitPrice: 18000, qty: 1, taxType: 'exempt' },
      ],
    }),
    { number: 'INV-2044', issueDate: '2026-09-21', dueDate: '2026-11-05' },
  )
  const text = renderInvoice(issued, { customer: { name: '누리테크 주식회사', bizNo: '1058711900' } })
  assert.deepStrictEqual(text.split('\n').slice(9), [
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
    HEADER_RULE,
    '금 십삼만육천육백칠십구원정',
    '입금 계좌: 국민은행 841-21-0412-339 한빛오피스(주)',
  ])
})
