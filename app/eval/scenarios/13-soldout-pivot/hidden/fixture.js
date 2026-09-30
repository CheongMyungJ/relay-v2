// 숨긴 시험 공용 데이터. 이름이 같은 꼴이라 글 점수는 같고 인기도로만 순서가 갈린다.
// 기준 순서(점수 순): L01 L02 L03 ... L10. 품절: L02, L06, L09
export const LANTERNS = [
  ['L01', 5, 1000],
  ['L02', 0, 900],
  ['L03', 7, 800],
  ['L04', 2, 700],
  ['L05', 12, 600],
  ['L06', 0, 500],
  ['L07', 4, 400],
  ['L08', 9, 300],
  ['L09', 0, 200],
  ['L10', 1, 100],
].map(([id, stock, popularity]) => ({
  id,
  name: `캠핑 랜턴 ${id}`,
  brand: '루멘',
  category: 'outdoor/camping',
  price: 30000,
  stock,
  popularity,
}))

export const SOLD_OUT = ['L02', 'L06', 'L09']
export const IN_STOCK = ['L01', 'L03', 'L04', 'L05', 'L07', 'L08', 'L10']

// 모든 쪽을 차례로 넘겨 모은 id
export function allPages(engine, query, pageSize, options = {}) {
  const out = []
  const first = engine.search(query, { ...options, page: 1, pageSize })
  for (let page = 1; page <= first.totalPages; page++) {
    const r = page === 1 ? first : engine.search(query, { ...options, page, pageSize })
    out.push(...r.items.map((i) => i.id))
  }
  return out
}
