/**
 * 샘플 데이터. createService({ seed: true })가 쓴다.
 * 서울에만 있는 상품과 서울·부산에 나눠 둔 상품이 섞여 있다.
 */
export const SEED_PRODUCTS = [
  { sku: 'A-100', name: '무선 마우스', category: '주변기기', price: 25000 },
  { sku: 'A-110', name: '기계식 키보드', category: '주변기기', price: 89000 },
  { sku: 'A-120', name: '마우스 패드', category: '주변기기', price: 9000 },
  { sku: 'B-200', name: '모니터 받침대', category: '사무용품', price: 32000 },
  { sku: 'B-210', name: 'USB 허브', category: '사무용품', price: 19000 },
  { sku: 'C-300', name: '노트북 파우치', category: '가방', price: 28000 },
  { sku: 'C-310', name: '케이블 정리함', category: '가방', price: 12000 },
]

export const SEED_STOCK = [
  { sku: 'A-100', warehouse: 'seoul', onHand: 12 },
  { sku: 'A-100', warehouse: 'busan', onHand: 3 },
  { sku: 'A-110', warehouse: 'seoul', onHand: 8 },
  { sku: 'A-110', warehouse: 'busan', onHand: 6 },
  { sku: 'A-120', warehouse: 'seoul', onHand: 40 },
  { sku: 'B-200', warehouse: 'seoul', onHand: 15 },
  { sku: 'B-210', warehouse: 'seoul', onHand: 20 },
  { sku: 'C-300', warehouse: 'seoul', onHand: 5 },
  { sku: 'C-300', warehouse: 'busan', onHand: 10 },
  { sku: 'C-310', warehouse: 'seoul', onHand: 30 },
]

export const SEED_PROMOTIONS = [
  {
    id: 'autumn-accessory',
    kind: 'percent',
    category: '주변기기',
    percent: 15,
    from: '2026-09-14T00:00:00+09:00',
    to: '2026-09-28T00:00:00+09:00',
  },
  {
    id: 'pad-3for2',
    kind: 'bundle',
    sku: 'A-120',
    buy: 2,
    free: 1,
    from: '2026-09-01T00:00:00+09:00',
    to: '2026-10-01T00:00:00+09:00',
  },
]

/** 초기 적재. 캐시를 거치지 않고 테이블에 바로 넣는다 */
export function loadStock(stockTable, rows, at) {
  for (const r of rows) {
    stockTable.put({ sku: r.sku, warehouse: r.warehouse, onHand: r.onHand, reserved: r.reserved ?? 0, updatedAt: at })
  }
}
