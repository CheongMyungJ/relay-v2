// 계정과목표. 첫 자리로 종류를 나눈다
// 1 자산, 2 부채, 3 자본, 4 수익, 5 비용
const CHART = {
  1010: '현금',
  1020: '보통예금',
  1100: '외상매출금',
  1300: '비품',
  2010: '외상매입금',
  2100: '미지급금',
  2300: '예수부가세',
  3010: '자본금',
  4010: '상품매출',
  4020: '용역매출',
  4900: '잡이익',
  5010: '상품매입',
  5110: '소모품비',
  5120: '복리후생비',
  5130: '여비교통비',
  5200: '임차료',
  5300: '지급수수료',
  5400: '광고선전비',
  5900: '잡손실',
}

const TYPES = { 1: 'asset', 2: 'liability', 3: 'equity', 4: 'revenue', 5: 'expense' }
const CASH = new Set(['1010', '1020'])

export function accountType(code) {
  return TYPES[String(code)[0]] ?? 'unknown'
}

export function accountName(code) {
  return CHART[code] ?? `(미등록 ${code})`
}

export function isKnownAccount(code) {
  return String(code) in CHART
}

export const isRevenue = (code) => accountType(code) === 'revenue'
export const isExpense = (code) => accountType(code) === 'expense'
export const isCash = (code) => CASH.has(String(code))

export function listAccounts(type) {
  return Object.entries(CHART)
    .filter(([code]) => !type || accountType(code) === type)
    .map(([code, name]) => ({ code, name, type: accountType(code) }))
}
