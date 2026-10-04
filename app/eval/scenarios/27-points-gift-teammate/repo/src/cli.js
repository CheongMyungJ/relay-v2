#!/usr/bin/env node
// 주문 JSON으로 영수증 찍어 보기
//   node src/cli.js examples/O-1042.json             주문을 만들어 영수증을 찍는다
//   node src/cli.js examples/G-0213.json             선물하기 주문
//   node src/cli.js examples/R-0311.json --order examples/O-1077.json   저장된 주문의 부분 환불
import fs from 'node:fs'
import { receiptLines, refundLines } from './format/receipt.js'
import { createGiftOrder } from './gift/gift-order.js'
import { createOrder } from './orders/order.js'
import { createRefund } from './orders/refund.js'

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const [file, ...rest] = process.argv.slice(2)
if (!file) {
  console.error('쓰는 법: node src/cli.js <주문.json> [--order <저장된 주문.json>]')
  process.exit(2)
}
const input = read(file)
const at = rest.indexOf('--order')
if (at >= 0) {
  console.log(refundLines(createRefund(read(rest[at + 1]), input)).join('\n'))
} else if (input.number?.startsWith('G-')) {
  console.log(receiptLines(createGiftOrder(input)).join('\n'))
} else {
  console.log(receiptLines(createOrder(input)).join('\n'))
}
