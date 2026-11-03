// 판매 기록: { date: 'YYYY-MM-DD', amount: number }. 환불은 음수 금액이다.

export function total(sales) {
  return sales.reduce((sum, s) => sum + s.amount, 0)
}
