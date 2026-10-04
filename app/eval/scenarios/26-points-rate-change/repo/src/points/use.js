import { MIN_POINT_USE, POINT_USE_UNIT } from '../config.js'

/** 포인트 사용 검사. 1,000P 이상, 10P 단위, 가진 포인트와 쿠폰을 뺀 상품 금액을 넘지 않는다 */
export function assertPointUse(used, balance, payableGoods) {
  if (!used) return
  if (!Number.isInteger(used) || used < 0) throw new Error(`사용 포인트가 잘못됐다: ${used}`)
  if (used < MIN_POINT_USE) throw new Error(`포인트는 ${MIN_POINT_USE}P부터 쓸 수 있다`)
  if (used % POINT_USE_UNIT) throw new Error(`포인트는 ${POINT_USE_UNIT}P 단위로 쓴다`)
  if (used > balance) throw new Error(`가진 포인트(${balance}P)보다 많이 쓸 수 없다`)
  if (used > payableGoods) throw new Error('상품 금액보다 많이 쓸 수 없다')
}
