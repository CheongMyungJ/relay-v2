import { formatMoney, formatPrice } from './price.js'

export function receiptLines(items) {
  return items.map((i) => `${i.name} ${i.qty}개 ${formatPrice(i.price * i.qty)}`)
}

export function pointsLine(points) {
  return `적립 ${formatMoney(points, { unit: 'P' })}`
}
