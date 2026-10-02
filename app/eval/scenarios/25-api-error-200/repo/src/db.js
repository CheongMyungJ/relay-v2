/** 메모리 저장소. 시험과 로컬 실행에서 쓴다 */
export function createDb(seed = {}) {
  return {
    products: new Map((seed.products ?? []).map((p) => [p.id, { ...p }])),
    orders: new Map((seed.orders ?? []).map((o) => [o.id, { ...o }])),
    carts: new Map(),
  }
}
