import { GIFT_NUMBER } from '../config.js'
import { normalizeLine } from '../cart/line.js'
import { orderAmounts } from '../orders/order.js'
import { assertPointUse } from '../points/use.js'
import { giftPoints } from './gift-points.js'

// 선물하기 주문. 보내는 사람이 결제하고 받는 사람 주소로 보낸다. 메시지 카드(60자까지)를 넣을 수 있다.
// 금액 계산은 일반 주문과 같고, 적립 포인트는 보내는 사람에게 쌓인다

export const MESSAGE_LIMIT = 60
const PHONE = /^01\d-\d{3,4}-\d{4}$/

export function createGiftOrder(input) {
  if (!GIFT_NUMBER.test(input.number ?? '')) throw new Error(`선물 주문 번호 형식은 G-0000: ${input.number}`)
  if (!input.customerId) throw new Error('보내는 사람이 없다')
  const r = input.recipient
  if (!r?.name) throw new Error('받는 사람 이름이 없다')
  if (!PHONE.test(r.phone ?? '')) throw new Error(`받는 사람 전화번호 형식은 010-0000-0000: ${r.phone}`)
  const message = input.message ?? ''
  if ([...message].length > MESSAGE_LIMIT) throw new Error(`메시지 카드는 ${MESSAGE_LIMIT}자까지`)
  const lines = (input.lines ?? []).map(normalizeLine)
  if (!lines.length) throw new Error('주문 줄이 없다')
  const pointsUsed = input.pointsUsed ?? 0
  const amounts = orderAmounts(lines, input.coupon, pointsUsed)
  assertPointUse(pointsUsed, input.pointBalance ?? Infinity, amounts.goods - amounts.coupon)
  const order = {
    number: input.number,
    customerId: input.customerId,
    orderedAt: input.orderedAt,
    recipient: { name: r.name, phone: r.phone },
    message,
    lines,
    coupon: input.coupon ?? null,
    amounts,
  }
  order.points = { used: pointsUsed, earned: giftPoints(order) }
  return order
}
