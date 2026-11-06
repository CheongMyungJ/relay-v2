// 묶음 상품(선물 세트). 구성 상품들의 가격 합에서 할인율만큼 깎은 값을 100원 단위로 내린다.
// 묶음의 재고는 구성 상품으로 만들 수 있는 수다. 묶음은 장바구니에 하나의 상품(sku)으로 담긴다.
import { fail } from '../shared/errors.js'

export function createBundles({ store, catalog }) {
  if (!store.bundles) store.bundles = new Map()

  function priceOf(items, discountPct) {
    const sum = items.reduce((s, it) => s + catalog.get(it.sku).price * it.qty, 0)
    return Math.floor((sum * (100 - discountPct)) / 100 / 100) * 100
  }

  /**
   * 묶음을 만들고 상품으로 등록한다. 구성 상품은 모두 과세 상품이어야 한다(면세와 섞으면 부가세를 나눌 수 없다).
   * @param {{ sku: string, name: string, items: { sku: string, qty: number }[], discountPct?: number }} o
   */
  function define({ sku, name, items, discountPct = 10 }) {
    if (!Array.isArray(items) || items.length < 2) fail('BAD_BUNDLE', '구성 상품은 둘 이상')
    if (discountPct < 0 || discountPct > 50) fail('BAD_BUNDLE', `할인율: ${discountPct}`)
    for (const it of items) {
      const p = catalog.get(it.sku)
      if (p.taxClass !== 'standard') fail('BAD_BUNDLE', `면세 상품은 묶을 수 없습니다: ${it.sku}`)
      if (!Number.isInteger(it.qty) || it.qty <= 0) fail('BAD_BUNDLE', `수량: ${it.qty}`)
    }
    const weightG = items.reduce((s, it) => s + catalog.get(it.sku).weightG * it.qty, 0)
    const product = catalog.add({ sku, name, price: priceOf(items, discountPct), weightG, stock: 0, category: 'bundle' })
    store.bundles.set(sku, { sku, items: items.map((it) => ({ ...it })), discountPct })
    refresh(sku)
    return { ...product, items }
  }

  /** 구성 상품의 재고와 가격으로 묶음의 재고와 가격을 다시 정한다 */
  function refresh(sku) {
    const b = store.bundles.get(sku)
    if (!b) fail('NOT_FOUND', `묶음이 없습니다: ${sku}`)
    const makeable = Math.min(...b.items.map((it) => Math.floor(catalog.get(it.sku).stock / it.qty)))
    const p = store.products.get(sku)
    p.stock = makeable
    p.price = priceOf(b.items, b.discountPct)
    p.active = b.items.every((it) => catalog.get(it.sku).active)
    return { ...p }
  }

  /** 묶음 n개를 만든다: 구성 상품 재고를 덜고 묶음 재고를 그대로 둔다(refresh가 다시 셈) */
  function assemble(sku, n) {
    const b = store.bundles.get(sku)
    if (!b) fail('NOT_FOUND', `묶음이 없습니다: ${sku}`)
    for (const it of b.items) catalog.reserve(it.sku, it.qty * n)
    const p = store.products.get(sku)
    refresh(sku)
    p.stock += n
    return { ...p }
  }

  return {
    define,
    refresh,
    assemble,
    get: (sku) => {
      const b = store.bundles.get(sku)
      return b ? { ...b, items: b.items.map((it) => ({ ...it })) } : null
    },
  }
}
