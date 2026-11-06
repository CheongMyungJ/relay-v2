// 청구: 송장, 반품 전표, 입금, 명세서, 연체, 독촉, 내보내기.
// 카드로 결제한 주문은 결제와 함께 송장을 내고 바로 입금 처리한다. 기업 고객의 후불 송장은 issueManualInvoice로 낸다.
// 이벤트: order.paid, order.cancelled를 듣는다. invoice.issued, invoice.paid, invoice.reminder, credit.issued를 낸다.
import { fail } from '../shared/errors.js'
import { addDays, daysBetween, kstDate } from '../shared/time.js'

export const DUE_DAYS = 14
export const REMINDER_DAYS = [7, 14, 30]
export const AGING_BUCKETS = [
  { label: '1-30', from: 1, to: 30 },
  { label: '31-60', from: 31, to: 60 },
  { label: '61-90', from: 61, to: 90 },
  { label: '90+', from: 91, to: Infinity },
]

/** 금액 표시: 12300 → '12,300원' */
export function formatWon(amount) {
  const n = Math.trunc(amount)
  return `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('ko-KR')}원`
}

/** 부가세 포함 금액의 부가세. 면세 0, 원 미만 버림 */
function lineVatOf(amount, taxClass = 'standard') {
  if (taxClass === 'exempt') return 0
  return Math.floor(amount / 11)
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function csvRow(cells) {
  return cells.map(csvCell).join(',')
}

/** 사업자등록번호(000-00-00000) 검사 숫자 확인 */
export function isBusinessNumber(text) {
  const digits = String(text ?? '').replace(/-/g, '')
  if (!/^\d{10}$/.test(digits)) return false
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * weights[i]
  sum += Math.floor((Number(digits[8]) * 5) / 10)
  return (10 - (sum % 10)) % 10 === Number(digits[9])
}

const STATUS_LABEL = {
  issued: '미납',
  partial: '일부 입금',
  paid: '입금 완료',
  void: '무효',
  written_off: '대손',
}

export function createBilling({ store, bus, clock, ids, customers }) {
  bus.on('order.paid', ({ order }) => {
    const invoice = issueForOrder(order)
    recordReceipt(invoice.id, order.paidAmount, { method: 'card', ref: order.paymentRef })
  })

  bus.on('order.cancelled', ({ order, refund, reason }) => {
    if (refund <= 0) return
    const invoice = store.invoices.find((i) => i.orderId === order.id)
    if (!invoice) return
    issueCreditNote({ invoiceId: invoice.id, amount: refund, reason: `주문 취소(${reason})` })
  })

  // ── 번호 ────────────────────────────────────────────────────────────────

  function nextInvoiceNumber() {
    const year = clock.now().getUTCFullYear()
    const n = store.invoices.length + 1
    return `INV-${year}-${String(n).padStart(5, '0')}`
  }

  function nextCreditNumber() {
    return `CN-${String(store.creditNotes.length + 1).padStart(5, '0')}`
  }

  // ── 송장 ────────────────────────────────────────────────────────────────

  function makeInvoice({ orderId = null, customerId, lines, dueDays = DUE_DAYS, note = null }) {
    customers.get(customerId)
    if (!Array.isArray(lines) || lines.length === 0) fail('BAD_INVOICE', '송장 줄이 없습니다')
    for (const l of lines) {
      if (!Number.isInteger(l.amount)) fail('BAD_INVOICE', `송장 줄 금액: ${l.amount}`)
    }
    const issuedAt = clock.now()
    const invoice = {
      id: ids.next('inv'),
      number: nextInvoiceNumber(),
      orderId,
      customerId,
      issuedAt: issuedAt.toISOString(),
      dueAt: addDays(issuedAt, dueDays).toISOString(),
      lines: lines.map((l) => ({
        name: l.name,
        qty: l.qty ?? 1,
        amount: l.amount,
        taxClass: l.taxClass ?? 'standard',
        vat: lineVatOf(l.amount, l.taxClass ?? 'standard'),
      })),
      total: 0,
      vat: 0,
      paidAmount: 0,
      status: 'issued',
      note,
    }
    invoice.total = invoice.lines.reduce((sum, l) => sum + l.amount, 0)
    invoice.vat = invoice.lines.reduce((sum, l) => sum + l.vat, 0)
    if (invoice.total <= 0) fail('BAD_INVOICE', '송장 합계가 0원 이하입니다')
    store.invoices.push(invoice)
    bus.emit('invoice.issued', { invoice: structuredClone(invoice) })
    return invoice
  }

  /** 주문의 송장. 상품 줄, 배송비 줄, 할인 줄(음수, 부가세 없음) */
  function issueForOrder(order) {
    const existing = store.invoices.find((i) => i.orderId === order.id)
    if (existing) return existing
    const lines = order.lines.map((l) => ({
      name: l.name,
      qty: l.qty,
      amount: l.amount,
      taxClass: l.taxClass,
    }))
    if (order.shipping > 0) lines.push({ name: '배송비', qty: 1, amount: order.shipping, taxClass: 'standard' })
    if (order.discount > 0) {
      lines.push({ name: `할인(${order.couponCode ?? '쿠폰'})`, qty: 1, amount: -order.discount, taxClass: 'exempt' })
    }
    return makeInvoice({ orderId: order.id, customerId: order.customerId, lines, dueDays: 0 })
  }

  /** 기업 고객의 후불 송장 */
  function issueManualInvoice({ customerId, lines, dueDays = DUE_DAYS, note = null }) {
    return structuredClone(makeInvoice({ customerId, lines, dueDays, note }))
  }

  function loadInvoice(invoiceId) {
    const invoice = store.invoices.find((i) => i.id === invoiceId)
    if (!invoice) fail('NOT_FOUND', `송장이 없습니다: ${invoiceId}`)
    return invoice
  }

  function getInvoice(invoiceId) {
    const invoice =
      store.invoices.find((i) => i.id === invoiceId) ?? store.voidedInvoices.find((i) => i.id === invoiceId)
    if (!invoice) fail('NOT_FOUND', `송장이 없습니다: ${invoiceId}`)
    return structuredClone(invoice)
  }

  function findInvoice(number) {
    const invoice =
      store.invoices.find((i) => i.number === number) ?? store.voidedInvoices.find((i) => i.number === number)
    return invoice ? structuredClone(invoice) : null
  }

  function invoiceForOrder(orderId) {
    const invoice = store.invoices.find((i) => i.orderId === orderId)
    return invoice ? structuredClone(invoice) : null
  }

  function listInvoices({ customerId, status } = {}) {
    return store.invoices
      .filter((i) => (!customerId || i.customerId === customerId) && (!status || i.status === status))
      .map((i) => structuredClone(i))
  }

  /** 잘못 낸 송장을 무효로 한다. 입금이 있으면 무효로 할 수 없다(먼저 환불) */
  function voidInvoice(invoiceId, reason) {
    const i = store.invoices.findIndex((x) => x.id === invoiceId)
    if (i < 0) fail('NOT_FOUND', `송장이 없습니다: ${invoiceId}`)
    const invoice = store.invoices[i]
    if (invoice.paidAmount > 0) fail('HAS_RECEIPTS', `입금이 있는 송장은 무효로 할 수 없습니다: ${invoice.number}`)
    if (!reason) fail('BAD_REQUEST', '무효 까닭이 없습니다')
    store.invoices.splice(i, 1)
    invoice.status = 'void'
    invoice.voidedAt = clock.now().toISOString()
    invoice.voidReason = reason
    store.voidedInvoices.push(invoice)
    return structuredClone(invoice)
  }

  /** 받을 수 없게 된 송장(대손). 남은 금액을 받지 않은 것으로 닫는다 */
  function writeOff(invoiceId, reason) {
    const invoice = loadInvoice(invoiceId)
    if (invoice.status === 'paid') fail('ALREADY_PAID', `입금이 끝난 송장: ${invoice.number}`)
    invoice.status = 'written_off'
    invoice.writtenOff = { amount: balanceOf(invoice), reason, at: clock.now().toISOString() }
    return structuredClone(invoice)
  }

  // ── 입금 ────────────────────────────────────────────────────────────────

  function balanceOf(invoice) {
    const credited = store.creditNotes
      .filter((c) => c.invoiceId === invoice.id)
      .reduce((sum, c) => sum + c.amount, 0)
    return invoice.total - invoice.paidAmount - credited
  }

  /** 입금을 적는다. 일부 입금도 받는다. 남은 금액보다 많이 받으면 오류 */
  function recordReceipt(invoiceId, amount, { method = 'transfer', ref = null, at = null } = {}) {
    const invoice = loadInvoice(invoiceId)
    if (invoice.status === 'void' || invoice.status === 'written_off') {
      fail('CLOSED_INVOICE', `닫힌 송장: ${invoice.number}`)
    }
    if (!Number.isInteger(amount) || amount <= 0) fail('BAD_AMOUNT', `입금 금액: ${amount}`)
    const due = invoice.total - invoice.paidAmount
    if (amount > due) fail('OVERPAID', `남은 금액(${due})보다 많은 입금: ${amount}`)
    const receipt = {
      id: ids.next('rcp'),
      invoiceId,
      amount,
      method,
      ref,
      at: at ?? clock.now().toISOString(),
    }
    store.receipts.push(receipt)
    invoice.paidAmount += amount
    invoice.status = invoice.paidAmount === invoice.total ? 'paid' : 'partial'
    if (invoice.status === 'paid') bus.emit('invoice.paid', { invoice: structuredClone(invoice) })
    return { ...receipt }
  }

  function receiptsFor(invoiceId) {
    return store.receipts.filter((r) => r.invoiceId === invoiceId).map((r) => ({ ...r }))
  }

  // ── 반품 전표 ────────────────────────────────────────────────────────────

  function issueCreditNote({ invoiceId, amount, reason }) {
    const invoice = loadInvoice(invoiceId)
    if (!Number.isInteger(amount) || amount <= 0) fail('BAD_AMOUNT', `전표 금액: ${amount}`)
    const credited = store.creditNotes
      .filter((c) => c.invoiceId === invoiceId)
      .reduce((sum, c) => sum + c.amount, 0)
    if (credited + amount > invoice.total) fail('BAD_AMOUNT', `송장 금액보다 큰 전표: ${invoice.number}`)
    const note = {
      id: ids.next('cn'),
      number: nextCreditNumber(),
      invoiceId,
      orderId: invoice.orderId,
      customerId: invoice.customerId,
      amount,
      vat: lineVatOf(amount),
      reason,
      issuedAt: clock.now().toISOString(),
    }
    store.creditNotes.push(note)
    bus.emit('credit.issued', { creditNote: { ...note }, invoice: structuredClone(invoice) })
    return { ...note }
  }

  function creditNotesFor(invoiceId) {
    return store.creditNotes.filter((c) => c.invoiceId === invoiceId).map((c) => ({ ...c }))
  }

  function listCreditNotes({ customerId } = {}) {
    return store.creditNotes.filter((c) => !customerId || c.customerId === customerId).map((c) => ({ ...c }))
  }

  // ── 보이는 글 ────────────────────────────────────────────────────────────

  function renderInvoice(invoiceId) {
    const invoice = getInvoice(invoiceId)
    const customer = customers.get(invoice.customerId)
    const rows = [
      `송장 ${invoice.number}`,
      `고객 ${customer.name}`,
      `발행 ${kstDate(invoice.issuedAt)}  납부 기한 ${kstDate(invoice.dueAt)}`,
      '',
    ]
    for (const l of invoice.lines) {
      const qty = l.qty > 1 ? ` x${l.qty}` : ''
      rows.push(`${l.name}${qty}  ${formatWon(l.amount)}`)
    }
    rows.push('')
    rows.push(`합계  ${formatWon(invoice.total)}`)
    rows.push(`부가세  ${formatWon(invoice.vat)}`)
    const credited = creditNotesFor(invoice.id).reduce((sum, c) => sum + c.amount, 0)
    if (credited > 0) rows.push(`전표  ${formatWon(-credited)}`)
    if (invoice.paidAmount > 0) rows.push(`입금  ${formatWon(invoice.paidAmount)}`)
    rows.push(`상태  ${STATUS_LABEL[invoice.status] ?? invoice.status}`)
    return rows.join('\n')
  }

  function renderCreditNote(creditNoteId) {
    const note = store.creditNotes.find((c) => c.id === creditNoteId)
    if (!note) fail('NOT_FOUND', `전표가 없습니다: ${creditNoteId}`)
    const invoice = getInvoice(note.invoiceId)
    return [
      `반품 전표 ${note.number}`,
      `원 송장 ${invoice.number}`,
      `발행 ${kstDate(note.issuedAt)}`,
      `금액  ${formatWon(-note.amount)}`,
      `부가세  ${formatWon(-note.vat)}`,
      `까닭  ${note.reason}`,
    ].join('\n')
  }

  // ── 명세서 ──────────────────────────────────────────────────────────────

  /**
   * 고객의 기간 명세서. 기간은 [from, to) 시각(ISO)이다.
   * 기초 잔액 + 송장 − 전표 − 입금 = 기말 잔액
   */
  function statementFor(customerId, { from, to }) {
    const customer = customers.get(customerId)
    const inRange = (at) => at >= from && at < to
    const before = (at) => at < from
    const invoices = store.invoices.filter((i) => i.customerId === customerId)
    const invoiceIds = new Set(invoices.map((i) => i.id))
    const credits = store.creditNotes.filter((c) => c.customerId === customerId)
    const receipts = store.receipts.filter((r) => invoiceIds.has(r.invoiceId))

    const sum = (list, pick = (x) => x.amount) => list.reduce((s, x) => s + pick(x), 0)
    const opening =
      sum(invoices.filter((i) => before(i.issuedAt)), (i) => i.total) -
      sum(credits.filter((c) => before(c.issuedAt))) -
      sum(receipts.filter((r) => before(r.at)))

    const entries = [
      ...invoices
        .filter((i) => inRange(i.issuedAt))
        .map((i) => ({ at: i.issuedAt, kind: 'invoice', number: i.number, amount: i.total })),
      ...credits
        .filter((c) => inRange(c.issuedAt))
        .map((c) => ({ at: c.issuedAt, kind: 'credit', number: c.number, amount: -c.amount })),
      ...receipts
        .filter((r) => inRange(r.at))
        .map((r) => ({ at: r.at, kind: 'receipt', number: r.id, amount: -r.amount })),
    ].sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind))

    const closing = opening + sum(entries)
    return { customerId, customerName: customer.name, from, to, opening, entries, closing }
  }

  const ENTRY_LABEL = { invoice: '송장', credit: '전표', receipt: '입금' }

  function renderStatement(statement) {
    const rows = [
      `${statement.customerName} 님 명세서 (${kstDate(statement.from)} ~ ${kstDate(new Date(new Date(statement.to).getTime() - 1))})`,
      `기초 잔액  ${formatWon(statement.opening)}`,
    ]
    for (const e of statement.entries) {
      rows.push(`${kstDate(e.at)}  ${ENTRY_LABEL[e.kind]} ${e.number}  ${formatWon(e.amount)}`)
    }
    rows.push(`기말 잔액  ${formatWon(statement.closing)}`)
    return rows.join('\n')
  }

  // ── 연체 ────────────────────────────────────────────────────────────────

  function isOpen(invoice) {
    return (invoice.status === 'issued' || invoice.status === 'partial') && balanceOf(invoice) > 0
  }

  /** 기한이 지난 미납 송장. 연체 일수가 긴 차례 */
  function overdueInvoices(asOf = clock.now()) {
    return store.invoices
      .filter((i) => isOpen(i) && new Date(i.dueAt) < new Date(asOf))
      .map((i) => ({
        invoice: structuredClone(i),
        balance: balanceOf(i),
        daysOverdue: daysBetween(i.dueAt, asOf),
      }))
      .filter((x) => x.daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue || a.invoice.number.localeCompare(b.invoice.number))
  }

  function agingReport(asOf = clock.now()) {
    const buckets = AGING_BUCKETS.map((b) => ({ label: b.label, count: 0, amount: 0 }))
    for (const x of overdueInvoices(asOf)) {
      const i = AGING_BUCKETS.findIndex((b) => x.daysOverdue >= b.from && x.daysOverdue <= b.to)
      buckets[i].count += 1
      buckets[i].amount += x.balance
    }
    const total = buckets.reduce((sum, b) => sum + b.amount, 0)
    return { asOf: new Date(asOf).toISOString(), buckets, total }
  }

  function renderAging(report) {
    const rows = [`연체 현황 (${kstDate(report.asOf)})`]
    for (const b of report.buckets) rows.push(`${b.label}일  ${b.count}건  ${formatWon(b.amount)}`)
    rows.push(`합계  ${formatWon(report.total)}`)
    return rows.join('\n')
  }

  /**
   * 독촉: 기한에서 7, 14, 30일이 지난 송장마다 한 번씩. 이미 보낸 단계는 다시 보내지 않는다.
   * @returns 이번에 보낸 독촉
   */
  function sendReminders(asOf = clock.now()) {
    const sent = []
    for (const x of overdueInvoices(asOf)) {
      const step = [...REMINDER_DAYS].reverse().find((d) => x.daysOverdue >= d)
      if (!step) continue
      const already = store.reminders.some((r) => r.invoiceId === x.invoice.id && r.step === step)
      if (already) continue
      const reminder = {
        invoiceId: x.invoice.id,
        number: x.invoice.number,
        customerId: x.invoice.customerId,
        step,
        balance: x.balance,
        at: new Date(asOf).toISOString(),
      }
      store.reminders.push(reminder)
      sent.push(reminder)
      bus.emit('invoice.reminder', { reminder: { ...reminder }, invoice: x.invoice })
    }
    return sent
  }

  function remindersFor(invoiceId) {
    return store.reminders.filter((r) => r.invoiceId === invoiceId).map((r) => ({ ...r }))
  }

  // ── 내보내기 ────────────────────────────────────────────────────────────

  /** 회계 프로그램으로 넘기는 송장 CSV. month는 'YYYY-MM' */
  function invoicesCsv(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) fail('BAD_REQUEST', `월: ${month}`)
    const rows = [csvRow(['number', 'issued', 'customer', 'total', 'vat', 'paid', 'status'])]
    const list = [...store.invoices, ...store.voidedInvoices]
      .filter((i) => i.issuedAt.slice(0, 7) === month)
      .sort((a, b) => a.number.localeCompare(b.number))
    for (const i of list) {
      const customer = customers.get(i.customerId)
      rows.push(
        csvRow([i.number, kstDate(i.issuedAt), customer.name, i.total, i.vat, i.paidAmount, i.status]),
      )
    }
    return `${rows.join('\n')}\n`
  }

  /** 고객이 지금까지 낸 금액(입금 − 전표) */
  function customerTotals(customerId) {
    const invoices = store.invoices.filter((i) => i.customerId === customerId)
    const ids = new Set(invoices.map((i) => i.id))
    const paid = store.receipts.filter((r) => ids.has(r.invoiceId)).reduce((sum, r) => sum + r.amount, 0)
    const credited = store.creditNotes
      .filter((c) => c.customerId === customerId)
      .reduce((sum, c) => sum + c.amount, 0)
    const open = invoices.filter(isOpen).reduce((sum, i) => sum + balanceOf(i), 0)
    return { invoices: invoices.length, paid, credited, net: paid - credited, open }
  }

  // ── 나눠 내기 ───────────────────────────────────────────────────────────

  /**
   * 후불 송장의 남은 금액을 parts번에 나눠 낼 계획. 첫 회차에 나머지 원을 몰고, 회차는 30일 간격이다.
   * 계획은 안내용이고 입금은 recordReceipt로 따로 적는다.
   */
  function installmentPlan(invoiceId, parts) {
    const invoice = loadInvoice(invoiceId)
    if (!Number.isInteger(parts) || parts < 2 || parts > 12) fail('BAD_REQUEST', `회차 수: ${parts}`)
    const balance = balanceOf(invoice)
    if (balance <= 0) fail('ALREADY_PAID', `남은 금액이 없는 송장: ${invoice.number}`)
    const each = Math.floor(balance / parts)
    const first = balance - each * (parts - 1)
    const start = new Date(invoice.dueAt) > clock.now() ? new Date(invoice.dueAt) : clock.now()
    const plan = Array.from({ length: parts }, (_, i) => ({
      no: i + 1,
      dueAt: addDays(start, i * 30).toISOString(),
      amount: i === 0 ? first : each,
    }))
    invoice.plan = plan
    return plan.map((p) => ({ ...p }))
  }

  // ── 세금계산서 ──────────────────────────────────────────────────────────

  /**
   * 기업 고객이 세금계산서를 원하면 국세청에 보낼 자료를 만든다. 공급가액 = 합계 − 부가세.
   * 할인 줄(음수)은 공급가액에서 뺀다. 한 송장에 한 번만 만든다.
   */
  function taxInvoiceData(invoiceId, { businessNumber, companyName, representative = null }) {
    const invoice = loadInvoice(invoiceId)
    if (!isBusinessNumber(businessNumber)) fail('BAD_BUSINESS_NUMBER', `사업자등록번호: ${businessNumber}`)
    if (!companyName) fail('BAD_REQUEST', '상호가 없습니다')
    if (invoice.taxInvoice) fail('ALREADY_ISSUED', `이미 세금계산서를 만든 송장: ${invoice.number}`)
    const taxable = invoice.lines.filter((l) => l.taxClass !== 'exempt')
    const exempt = invoice.lines.filter((l) => l.taxClass === 'exempt')
    const supply = taxable.reduce((sum, l) => sum + l.amount - l.vat, 0)
    const data = {
      invoiceNumber: invoice.number,
      writtenAt: kstDate(invoice.issuedAt),
      buyer: { businessNumber, companyName, representative },
      supplyAmount: supply,
      taxAmount: invoice.vat,
      exemptAmount: exempt.reduce((sum, l) => sum + l.amount, 0),
      items: taxable.map((l) => ({ name: l.name, qty: l.qty, supply: l.amount - l.vat, tax: l.vat })),
    }
    invoice.taxInvoice = { businessNumber, at: clock.now().toISOString() }
    return data
  }

  // ── 고치기, 찾기 ────────────────────────────────────────────────────────

  /** 입금 전의 후불 송장 줄을 고친다(번호와 발행일은 그대로) */
  function adjustInvoice(invoiceId, { lines, note }) {
    const invoice = loadInvoice(invoiceId)
    if (invoice.orderId) fail('ORDER_INVOICE', `주문 송장은 고칠 수 없습니다: ${invoice.number}`)
    if (invoice.paidAmount > 0) fail('HAS_RECEIPTS', `입금이 있는 송장: ${invoice.number}`)
    if (!Array.isArray(lines) || lines.length === 0) fail('BAD_INVOICE', '송장 줄이 없습니다')
    invoice.lines = lines.map((l) => ({
      name: l.name,
      qty: l.qty ?? 1,
      amount: l.amount,
      taxClass: l.taxClass ?? 'standard',
      vat: lineVatOf(l.amount, l.taxClass ?? 'standard'),
    }))
    invoice.total = invoice.lines.reduce((sum, l) => sum + l.amount, 0)
    invoice.vat = invoice.lines.reduce((sum, l) => sum + l.vat, 0)
    if (invoice.total <= 0) fail('BAD_INVOICE', '송장 합계가 0원 이하입니다')
    invoice.adjustedAt = clock.now().toISOString()
    if (note) invoice.note = note
    return structuredClone(invoice)
  }

  /** 송장 찾기: 번호나 고객 이름의 일부, 기간(발행 시각), 최소 금액 */
  function searchInvoices({ text = '', from = null, to = null, minTotal = 0 } = {}) {
    const needle = text.trim().toLowerCase()
    return store.invoices
      .filter((i) => {
        if (from && i.issuedAt < from) return false
        if (to && i.issuedAt >= to) return false
        if (i.total < minTotal) return false
        if (!needle) return true
        const name = customers.get(i.customerId).name.toLowerCase()
        return i.number.toLowerCase().includes(needle) || name.includes(needle)
      })
      .map((i) => structuredClone(i))
  }

  /** 입금 CSV. month는 'YYYY-MM' */
  function receiptsCsv(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) fail('BAD_REQUEST', `월: ${month}`)
    const rows = [csvRow(['receipt', 'at', 'invoice', 'amount', 'method'])]
    for (const r of store.receipts.filter((x) => x.at.slice(0, 7) === month)) {
      const invoice = store.invoices.find((i) => i.id === r.invoiceId)
      rows.push(csvRow([r.id, kstDate(r.at), invoice?.number ?? '', r.amount, r.method]))
    }
    return `${rows.join('\n')}\n`
  }

  return {
    issueForOrder,
    issueManualInvoice,
    getInvoice,
    findInvoice,
    invoiceForOrder,
    listInvoices,
    voidInvoice,
    writeOff,
    recordReceipt,
    receiptsFor,
    balance: (invoiceId) => balanceOf(loadInvoice(invoiceId)),
    issueCreditNote,
    creditNotesFor,
    listCreditNotes,
    renderInvoice,
    renderCreditNote,
    statementFor,
    renderStatement,
    overdueInvoices,
    agingReport,
    renderAging,
    sendReminders,
    remindersFor,
    invoicesCsv,
    receiptsCsv,
    customerTotals,
    taxInvoiceData,
    adjustInvoice,
    searchInvoices,
    installmentPlan,
  }
}
