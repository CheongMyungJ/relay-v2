#!/usr/bin/env node
// 청구서 JSON을 서식으로 찍어 본다.
//   node src/cli.js examples/INV-2031.json                 서식 출력
//   node src/cli.js examples/INV-2031.json --totals        합계만 JSON으로
//   node src/cli.js examples/INV-2031.json --customers examples/customers.json
import fs from 'node:fs'
import { createCustomerStore } from './customers/store.js'
import { renderInvoice } from './format/invoice-text.js'
import { createInvoice, invoiceTotals } from './invoice/invoice.js'

function parseArgs(argv) {
  const args = { file: null, totals: false, customers: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--totals') args.totals = true
    else if (a === '--customers') args.customers = argv[++i]
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
