import { NotFoundError, ValidationError } from '../util/errors.js'

const SKU_RE = /^[A-Z]-\d{3}$/

export function validateProduct(p) {
  if (!SKU_RE.test(p.sku ?? '')) throw new ValidationError(`SKU 형식이 잘못됨: ${p.sku}`)
  if (!p.name) throw new ValidationError(`상품 이름이 없음: ${p.sku}`)
  if (!Number.isInteger(p.price) || p.price < 0) throw new ValidationError(`가격이 잘못됨: ${p.sku} ${p.price}`)
  if (!p.category) throw new ValidationError(`분류가 없음: ${p.sku}`)
  return { active: true, ...p }
}

/** 상품 목록. 가격은 원 단위 정수(부가세 별도) */
export function createCatalog(items = []) {
  const bySku = new Map()

  function add(product) {
    const p = validateProduct(product)
    if (bySku.has(p.sku)) throw new ValidationError(`이미 있는 SKU: ${p.sku}`)
    bySku.set(p.sku, Object.freeze(p))
    return p
  }

  for (const item of items) add(item)

  return {
    add,
    get(sku) {
      const p = bySku.get(sku)
      if (!p) throw new NotFoundError(`없는 상품: ${sku}`)
      return p
    },
    find(sku) {
      return bySku.get(sku) ?? null
    },
    list({ category, activeOnly = true } = {}) {
      return [...bySku.values()]
        .filter((p) => (!category || p.category === category) && (!activeOnly || p.active))
        .sort((a, b) => a.sku.localeCompare(b.sku))
    },
    categories() {
      return [...new Set([...bySku.values()].map((p) => p.category))].sort()
    },
  }
}
