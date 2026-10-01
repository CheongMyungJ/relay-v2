// 적립금: 주문 금액의 1%를 적립한다
const balances = new Map()

export function addPoints(customer, amount) {
  balances.set(customer, (balances.get(customer) ?? 0) + Math.floor(amount / 100))
}

export function balance(customer) {
  return balances.get(customer) ?? 0
}

export function clearPoints() {
  balances.clear()
}
