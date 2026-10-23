import { formatPrice } from './price.js'

export function cartTotal(items) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  return `합계 ${formatPrice(total)}`
}
