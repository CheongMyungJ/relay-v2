import { pt, won } from './won.js'

// 주문 영수증 글자. 앱과 메일이 줄 단위로 그대로 보여 준다. 저장된 금액을 쓴다.
// 칸 너비(라벨 10칸, 금액 오른쪽 맞춤 12칸)와 줄 차례를 바꾸면 앱 화면이 어긋난다

const row = (label, value) => `${label.padEnd(10, ' ')}${value.padStart(12, ' ')}`

export function receiptLines(order) {
  const a = order.amounts
  const out = [order.number.startsWith('G-') ? `선물 ${order.number}` : `주문 ${order.number}`]
  out.push(row('상품 금액', won(a.goods)))
  if (a.coupon) out.push(row('쿠폰 할인', won(-a.coupon)))
  out.push(row('배송비', won(a.shipping)))
  if (a.pointsUsed) out.push(row('포인트 사용', won(-a.pointsUsed)))
  out.push(row('결제 금액', won(a.total)))
  out.push(row('적립 예정', pt(order.points.earned)))
  return out
}

export function refundLines(refund) {
  return [
    `환불 ${refund.number} (주문 ${refund.orderNumber})`,
    row('환불 금액', won(refund.refundAmount)),
    row('포인트 회수', pt(-refund.pointsRecovered)),
  ]
}
