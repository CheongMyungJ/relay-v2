// 장바구니. 담을 때의 가격을 줄에 적어 둔다(주문할 때 이 가격으로 계산한다).
import { fail } from '../shared/errors.js'

export function createCart(catalog) {
  const lines = []

  function add(sku, qty = 1) {
    if (!Number.isInteger(qty) || qty <= 0) fail('BAD_QTY', `수량: ${qty}`)
    const p = catalog.get(sku)
    if (!p.active) fail('DISCONTINUED', `판매 중지된 상품: ${sku}`)
    const line = lines.find((l) => l.sku === sku)
    if (line) {
      line.qty += qty
    } else {
      lines.push({ sku, name: p.name, price: p.price, taxClass: p.taxClass, weightG: p.weightG, qty })
    }
    return api
  }

  function setQty(sku, qty) {
    const i = lines.findIndex((l) => l.sku === sku)
    if (i < 0) fail('NOT_IN_CART', `장바구니에 없는 상품: ${sku}`)
    if (qty === 0) lines.splice(i, 1)
    else if (!Number.isInteger(qty) || qty < 0) fail('BAD_QTY', `수량: ${qty}`)
    else lines[i].qty = qty
    return api
  }

  function remove(sku) {
    const i = lines.findIndex((l) => l.sku === sku)
    if (i >= 0) lines.splice(i, 1)
    return api
  }

  const api = {
    add,
    setQty,
    remove,
    lines: () => lines.map((l) => ({ ...l })),
    isEmpty: () => lines.length === 0,
    subtotal: () => lines.reduce((sum, l) => sum + l.price * l.qty, 0),
    clear: () => {
      lines.length = 0
      return api
    },
  }
  return api
}
