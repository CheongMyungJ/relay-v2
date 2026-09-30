// 화면과 파일에 쓰는 이름
const LABELS = {
  'profit-loss': '손익계산',
  cashflow: '현금흐름',
  balance: '계정 잔액',
  monthly: '월별 합계',
  category: '분류별 지출',
  vat: '부가세',
  vendor: '거래처별 매입',
  budget: '예산 대비 실적',
  revenue: '수익',
  expense: '비용',
  net: '순이익',
  inflow: '들어온 돈',
  outflow: '나간 돈',
  opening: '기초',
  closing: '기말',
}

export function label(key) {
  return LABELS[key] ?? key
}

export function hasLabel(key) {
  return key in LABELS
}
