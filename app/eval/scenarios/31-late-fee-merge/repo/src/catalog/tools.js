import { NotFoundError } from '../util/errors.js'

// partnerId가 null이면 매장 공구다
const TOOLS = [
  { id: 'T-100', name: '전동 드릴', category: 'power', dailyRate: 8000, deposit: 50000, partnerId: null },
  { id: 'T-101', name: '임팩트 드라이버', category: 'power', dailyRate: 9000, deposit: 60000, partnerId: 'P-1' },
  { id: 'T-200', name: '사다리 3m', category: 'ladder', dailyRate: 5000, deposit: 30000, partnerId: null },
  { id: 'T-201', name: '접이식 사다리 2m', category: 'ladder', dailyRate: 3333, deposit: 20000, partnerId: 'P-2' },
  { id: 'T-300', name: '고압 세척기', category: 'garden', dailyRate: 15000, deposit: 120000, partnerId: 'P-1' },
  { id: 'T-301', name: '잔디깎이', category: 'garden', dailyRate: 12000, deposit: 100000, partnerId: null },
  { id: 'T-400', name: '타일 커터', category: 'hand', dailyRate: 7000, deposit: 40000, partnerId: 'P-2' },
  { id: 'T-401', name: '배관 렌치 세트', category: 'hand', dailyRate: 4500, deposit: 25000, partnerId: null },
]

export function getTool(id) {
  const t = TOOLS.find((x) => x.id === id)
  if (!t) throw new NotFoundError('공구', id)
  return t
}

export function listTools({ category } = {}) {
  return TOOLS.filter((t) => !category || t.category === category)
}

export const CATEGORIES = {
  power: '전동 공구',
  ladder: '사다리',
  garden: '정원',
  hand: '수공구',
}
