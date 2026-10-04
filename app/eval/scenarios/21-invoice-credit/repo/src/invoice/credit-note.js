import { CREDIT_NOTE_PREFIX, VAT_RATE_PERCENT } from '../config.js'
import { assertDate } from '../format/date.js'
import { percentOf, sumWon } from '../money.js'
import { isTaxableLine } from './tax-type.js'

// 반품 전표. 발행된 청구서의 품목 일부(또는 전부)를 거래처가 돌려보낼 때 만든다.
// 돌려주는 금액은 양수로 적는다. 분개에서 청구서와 반대 방향으로 쓴다(src/export/ledger.js).
// 전표를 만들 때 금액을 계산해 totals에 저장하고, 그 뒤로는 저장된 금액을 쓴다(청구서와 같다).

// 돌려받을 수 있는 청구서 상태. 취소된 청구서는 반품이 아니라 취소 분개로 처리한다
const RETURNABLE = ['issued', 'paid']

// 반품 전표를 만든다
// data: { number, issueDate, reason, returns: [{ sku, qty }] }
//   returns의 sku는 청구서 품목 줄의 sku. 같은 sku가 두 번 나오면 수량을 더한다
export function createCreditNote(invoice, data) {
  if (!RETURNABLE.includes(invoice?.status)) {
    throw new Error(`발행되었거나 입금된 청구서만 반품할 수 있다: ${invoice?.number ?? '(번호 없음)'}`)
  }
  const { number, issueDate, reason, returns } = data ?? {}
  if (!number || !number.startsWith(CREDIT_NOTE_PREFIX)) {
    throw new Error(`반품 전표 번호는 ${CREDIT_NOTE_PREFIX}로 시작한다: ${number}`)
  }
  if (!reason) throw new Error('반품 사유가 필요하다')
  if (!Array.isArray(returns) || returns.length === 0) throw new Error('돌려받는 품목이 없다')
  assertDate(issueDate)
  if (invoice.issueDate && issueDate < invoice.issueDate) {
    throw new Error(`반품 전표(${issueDate})가 청구서 발행일(${invoice.issueDate})보다 앞선다`)
  }

  const lines = returnedLines(invoice, returns)
  return {
    number,
    invoiceNumber: invoice.number,
    customerId: invoice.customerId,
    issueDate,
    reason: String(reason),
    zeroRated: Boolean(invoice.zeroRated),
    lines,
    totals: creditTotals({ lines, zeroRated: invoice.zeroRated }),
  }
}

// 돌려받는 품목 줄. 청구서 품목 줄을 복사하고 수량을 돌려받는 수량으로, 원래 수량을 origQty로 둔다
function returnedLines(invoice, returns) {
  const qtyBySku = new Map()
  for (const r of returns) {
    if (!r?.sku) throw new Error('돌려받는 품목에 sku가 없다')
    if (!Number.isInteger(r.qty) || r.qty <= 0) throw new RangeError(`${r.sku}: 반품 수량은 1 이상의 정수여야 한다`)
    qtyBySku.set(r.sku, (qtyBySku.get(r.sku) ?? 0) + r.qty)
  }
  const out = []
  for (const [sku, qty] of qtyBySku) {
    const found = invoice.lines.filter((l) => l.sku === sku)
    if (found.length === 0) throw new Error(`청구서 ${invoice.number}에 없는 품목: ${sku}`)
    if (found.length > 1) throw new Error(`청구서 ${invoice.number}에 ${sku} 줄이 여럿이다. 줄을 합친 뒤 반품한다`)
    const line = found[0]
    if (qty > line.qty) throw new RangeError(`${line.name}: 반품 수량(${qty})이 청구 수량(${line.qty})보다 많다`)
    out.push({ ...line, qty, origQty: line.qty })
  }
  return out
}

// 돌려받는 줄의 할인. 비율 할인은 같은 비율로, 금액 할인은 수량 비율로 나눈다(원 단위 반올림).
// 줄을 모두 돌려받으면 청구서의 할인과 같다
export function returnedDiscount(line) {
  const d = line.discount
  if (!d) return 0
  if (d.percent != null) return percentOf(line.unitPrice * line.qty, d.percent)
  if (line.qty === line.origQty) return d.amount
  return Math.round((d.amount * line.qty) / line.origQty)
}

// 돌려받는 줄마다 할인 전 금액, 할인, 공급가액
export function creditLineAmounts(note) {
  return note.lines.map((line) => {
    const gross = line.unitPrice * line.qty
    const discount = returnedDiscount(line)
    return { line, gross, discount, net: gross - discount, taxable: isTaxableLine(line) }
  })
}

// 반품 전표의 돌려주는 금액
//   supply: 공급가액, taxable / exempt: 과세분 / 면세분, vat: 부가세, total: 돌려주는 합계
export function creditTotals(note) {
  const rows = creditLineAmounts(note)
  const taxable = sumWon(rows.filter((r) => r.taxable).map((r) => r.net))
  const exempt = sumWon(rows.filter((r) => !r.taxable).map((r) => r.net))
  const supply = taxable + exempt
  const vat = note.zeroRated ? 0 : Math.round((taxable * VAT_RATE_PERCENT) / 100)
  return { supply, taxable, exempt, vat, total: supply + vat }
}

// 반품 전표의 금액. 저장된 금액이 있으면 그대로 쓴다(다시 계산하지 않는다)
export function creditNoteTotals(note) {
  return note.totals ?? creditTotals(note)
}
