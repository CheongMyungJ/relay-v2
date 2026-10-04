import { assertWon } from '../money.js'

/** 주문 줄을 검사하고 기본값을 채운다 */
export function normalizeLine(line) {
  if (!line || typeof line !== 'object') throw new Error('주문 줄이 비었다')
  if (!line.sku) throw new Error('주문 줄에 sku가 없다')
  const qty = line.qty ?? 1
  if (!Number.isInteger(qty) || qty < 1) throw new Error(`수량이 잘못됐다: ${line.sku} ${qty}`)
  assertWon(line.unitPrice, `${line.sku} 단가`)
  return { sku: line.sku, name: line.name ?? line.sku, unitPrice: line.unitPrice, qty }
}

export function lineAmount(line) {
  return line.unitPrice * line.qty
}
