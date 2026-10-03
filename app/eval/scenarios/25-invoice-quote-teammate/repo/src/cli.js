#!/usr/bin/env node
// 청구서 JSON을 서식으로 찍어 본다.
//   node src/cli.js examples/INV-2031.json                 서식 출력
//   node src/cli.js examples/INV-2031.json --totals        합계만 JSON으로
//   node src/cli.js examples/INV-2031.json --customers examples/customers.json
//   node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json   반품 전표 금액을 JSON으로
//   node src/cli.js examples/Q-0457.json                   견적서 금액과 유효 기간을 JSON으로
import fs from 'node:fs'
import { createCustomerStore } from './customers/store.js'
import { renderInvoice } from './format/invoice-text.js'
import { createCreditNote } from './invoice/credit-note.js'
import { createInvoice, invoiceTotals } from './invoice/invoice.js'
import { createQuote, quoteValidUntil } from './invoice/quote.js'

function parseArgs(argv) {
  const args = { file: null, totals: false, customers: null, invoice: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--totals') args.totals = true
    else if (a === '--customers') args.customers = argv[++i]
    else if (a === '--invoice') args.invoice = argv[++i]
    else if (!args.file) args.file = a
    else throw new Error(`알 수 없는 인자: ${a}`)
  }
  if (!args.file) throw new Error('청구서 JSON 파일을 주어야 한다')
  return args
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function main(argv) {
  const args = parseArgs(argv)
  const data = readJson(args.file)
  // 반품 요청: 원래 청구서(발행된 것)가 필요하다
  if (data.returns) {
    if (!args.invoice) throw new Error('반품 전표는 --invoice로 원래 청구서를 주어야 한다')
    const invoice = readJson(args.invoice)
    if (data.invoiceNumber && data.invoiceNumber !== invoice.number) {
      throw new Error(`반품 요청의 청구서(${data.invoiceNumber})와 주어진 청구서(${invoice.number})가 다르다`)
    }
    const note = createCreditNote(invoice, data)
    console.log(JSON.stringify({ number: note.number, invoiceNumber: note.invoiceNumber, totals: note.totals }, null, 2))
    return
  }
  // 견적서
  if (/^Q-/.test(String(data.number ?? ''))) {
    const quote = createQuote(data)
    console.log(JSON.stringify({ number: quote.number, validUntil: quoteValidUntil(quote), totals: quote.totals }, null, 2))
    return
  }
  // 발행된 청구서(status, totals가 있음)는 그대로 쓰고, 입력 데이터면 초안으로 만든다
  const invoice = data.status && data.status !== 'draft' ? data : createInvoice(data)
  if (args.totals) {
    console.log(JSON.stringify(invoiceTotals(invoice), null, 2))
    return
  }
  const customers = args.customers ? createCustomerStore(readJson(args.customers)) : null
  console.log(renderInvoice(invoice, { customer: customers?.get(invoice.customerId) ?? undefined }))
}

try {
  main(process.argv.slice(2))
} catch (e) {
  console.error(`오류: ${e.message}`)
  process.exit(1)
}
