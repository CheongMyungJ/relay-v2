// 장바구니 합계와 영수증 줄
// item: { name, unitPrice, qty, discountRate } (discountRate는 0~1, 없으면 0)

export function cartTotal(items) {
  let total = 0
  for (const item of items) {
    const rate = item.discountRate ?? 0
    total += Math.round(item.unitPrice * item.qty * (1 - rate))
  }
  return total
}

export function receiptLines(items) {
  return items.map((item) => {
    const rate = item.discountRate ?? 0
    const price = Math.round(item.unitPrice * item.qty * (1 - rate))
    return `${item.name} x${item.qty} ${price}원`
  })
}
