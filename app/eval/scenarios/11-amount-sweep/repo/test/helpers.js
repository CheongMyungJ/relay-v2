// 시험용 원장 행 만들기
export function row(date, account, amount, extra = {}) {
  return { date, account: String(account), category: '', vendor: '', memo: '', amount, vat: '', ...extra }
}
