import { POINT_RATE_PERCENT, REFUND_NUMBER } from '../config.js'
import { lineAmount } from '../cart/line.js'
import { percentOf, sumWon } from '../money.js'

// 환불. order는 저장된 주문(createOrder의 결과를 저장한 것)이다. 저장된 금액과 적립 포인트를 쓴다.
// - 부분 환불(createRefund): 돌려받는 줄의 상품 금액을 돌려주고, 적립했던 포인트 일부를 회수한다.
//   쿠폰 할인과 사용한 포인트는 남은 주문에 그대로 둔다. 남은 상품 금액이 그보다 적어지면 전체 취소로 한다.
// - 전체 취소(cancelOrder): 결제 금액을 모두 돌려주고, 적립 포인트를 모두 회수하고, 사용한 포인트를 돌려준다.

export function createRefund(order, input) {
  if (!REFUND_NUMBER.test(input.number ?? '')) throw new Error(`환불 번호 형식은 R-0000: ${input.number}`)
  const already = new Map((input.alreadyRefunded ?? []).map((r) => [r.sku, r.qty]))
  const items = (input.items ?? []).map((it) => {
    const line = order.lines.find((l) => l.sku === it.sku)
    if (!line) throw new Error(`주문에 없는 상품: ${it.sku}`)
    const left = line.qty - (already.get(it.sku) ?? 0)
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > left)
      throw new Error(`환불 수량이 잘못됐다: ${it.sku} ${it.qty} (남은 수량 ${left})`)
    return { sku: it.sku, unitPrice: line.unitPrice, qty: it.qty }
  })
  if (!items.length) throw new Error('환불할 상품이 없다')
  const refundGoods = sumWon(items.map(lineAmount))
  const refundedBefore = sumWon(
    order.lines.map((l) => l.unitPrice * (already.get(l.sku) ?? 0)),
  )
  const remainingGoods = order.amounts.goods - refundedBefore - refundGoods
  if (remainingGoods < order.amounts.coupon + order.amounts.pointsUsed)
    throw new Error('남은 상품 금액이 쿠폰 할인과 사용 포인트보다 적다. 전체 취소로 처리한다')
  return {
    number: input.number,
    orderNumber: order.number,
    items,
    refundAmount: refundGoods,
    pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT),
  }
}

export function cancelOrder(order) {
  return {
    orderNumber: order.number,
    refundAmount: order.amounts.total,
    pointsRecovered: order.points.earned,
    pointsReturned: order.points.used,
  }
}
