// 찜 목록. 고객마다 상품 50개까지. 판매 중지된 상품은 목록에 남지만 담을 수 없다고 표시한다.
import { fail } from '../shared/errors.js'

export const WISHLIST_MAX = 50

export function createWishlist({ store, catalog, customers, clock }) {
  if (!store.wishlists) store.wishlists = new Map()

  const listOf = (customerId) => {
    customers.get(customerId)
    if (!store.wishlists.has(customerId)) store.wishlists.set(customerId, [])
    return store.wishlists.get(customerId)
  }

  return {
    add(customerId, sku) {
      catalog.get(sku)
      const list = listOf(customerId)
      if (list.some((x) => x.sku === sku)) return false
      if (list.length >= WISHLIST_MAX) fail('WISHLIST_FULL', `찜은 ${WISHLIST_MAX}개까지`)
      list.push({ sku, addedAt: clock.now().toISOString() })
      return true
    },
    remove(customerId, sku) {
      const list = listOf(customerId)
      const i = list.findIndex((x) => x.sku === sku)
      if (i >= 0) list.splice(i, 1)
      return i >= 0
    },
    list(customerId) {
      return listOf(customerId).map((x) => {
        const p = catalog.find(x.sku)
        return { ...x, name: p?.name ?? null, price: p?.price ?? null, available: !!p?.active && p.stock > 0 }
      })
    },
  }
}
