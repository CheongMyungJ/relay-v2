import fs from 'node:fs'
import { formatWon } from './money.js'
import { orderAmounts } from './order.js'
import { earnPoints } from './points.js'
import { buildPgRequest, sendToPg } from './pg.js'

const file = process.argv[2]
if (!file) {
  console.error('쓰는 법: node src/cli.js <주문 파일>')
  process.exit(1)
}
const { order, member, payment } = JSON.parse(fs.readFileSync(file, 'utf8'))
const amounts = orderAmounts(order)
console.log(`상품 ${formatWon(amounts.items)}, 배송비 ${formatWon(amounts.shipping)}, 결제 ${formatWon(amounts.paid)}`)
console.log(`적립 ${earnPoints(amounts, member)}점 (${member.grade})`)
const req = buildPgRequest(order, payment)
console.log(`PG 요청 금액 ${req.amount} (${req.installment}개월)`, sendToPg(req))
