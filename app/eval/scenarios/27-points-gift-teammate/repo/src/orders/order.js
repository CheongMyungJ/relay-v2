import { ORDER_NUMBER } from '../config.js'
import { couponDiscount } from '../cart/coupon.js'
import { lineAmount, normalizeLine } from '../cart/line.js'
import { sumWon } from '../money.js'
import { earnPoints } from '../points/earn.js'
import { assertPointUse } from '../points/use.js'
import { shippingFee } from './shipping.js'

// 주문. 만들 때 금액(amounts)과 적립 포인트(points.earned)를 계산해 저장한다.
// 그 뒤 영수증, 환불, 포인트 내역은 저장된 값을 쓴다

export function orderAmounts(lines, coupon, pointsUsed = 0) {
  const goods = sumWon(lines.map(lineAmount))
  const discount = couponDiscount(goods, coupon)
  const shipping = shippingFee(goods - discount)
  return { goods, coupon: discount, shipping, pointsUsed, total: goods - discount + shipping - pointsUsed }
}

export function createOrder(input) {
  if (!ORDER_NUMBER.test(input.number ?? '')) throw new Error(`주문 번호 형식은 O-0000: ${input.number}`)
  if (!input.customerId) throw new Error('고객이 없다')
  const lines = (input.lines ?? []).map(normalizeLine)
  if (!lines.length) throw new Error('주문 줄이 없다')
  const pointsUsed = input.pointsUsed ?? 0
  const amounts = orderAmounts(lines, input.coupon, pointsUsed)
  assertPointUse(pointsUsed, input.pointBalance ?? Infinity, amounts.goods - amounts.coupon)
  const order = {
    number: input.number,
    customerId: input.customerId,
    orderedAt: input.orderedAt,
    lines,
    coupon: input.coupon ?? null,
    amounts,
  }
  order.points = { used: pointsUsed, earned: earnPoints(order) }
  return order
}
