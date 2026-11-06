// 상품과 재고.
import { fail } from '../shared/errors.js'

const TAX_CLASSES = ['standard', 'exempt']

export function createCatalog(store) {
  function validate(p) {
    if (!p.sku || typeof p.sku !== 'string') fail('BAD_PRODUCT', 'sku가 없습니다')
    if (!p.name) fail('BAD_PRODUCT', `${p.sku}: 이름이 없습니다`)
    if (!Number.isInteger(p.price) || p.price < 0) fail('BAD_PRODUCT', `${p.sku}: 가격은 0 이상의 정수`)
    if (!TAX_CLASSES.includes(p.taxClass)) fail('BAD_PRODUCT', `${p.sku}: 세금 구분 ${p.taxClass}`)
    if (!Number.isInteger(p.stock) || p.stock < 0) fail('BAD_PRODUCT', `${p.sku}: 재고는 0 이상의 정수`)
  }

  function add({ sku, name, price, taxClass = 'standard', weightG = 500, stock = 0, category = 'etc' }) {
    const product = { sku, name, price, taxClass, weightG, stock, category, active: true }
    validate(product)
    if (store.products.has(sku)) fail('DUPLICATE_SKU', `이미 있는 상품: ${sku}`)
    store.products.set(sku, product)
    return { ...product }
  }

  function load(sku) {
    const p = store.products.get(sku)
    if (!p) fail('NOT_FOUND', `상품이 없습니다: ${sku}`)
    return p
  }

  function get(sku) {
    return { ...load(sku) }
  }

  function find(sku) {
    const p = store.products.get(sku)
    return p ? { ...p } : null
  }

  function list({ category, activeOnly = true } = {}) {
    return [...store.products.values()]
      .filter((p) => (!activeOnly || p.active) && (!category || p.category === category))
      .map((p) => ({ ...p }))
  }

  function setPrice(sku, price) {
    const p = load(sku)
    if (!Number.isInteger(price) || price < 0) fail('BAD_PRODUCT', `${sku}: 가격은 0 이상의 정수`)
    p.price = price
    return { ...p }
  }

  function discontinue(sku) {
    load(sku).active = false
  }

  function reserve(sku, qty) {
    const p = load(sku)
    if (!p.active) fail('DISCONTINUED', `판매 중지된 상품: ${sku}`)
    if (p.stock < qty) fail('OUT_OF_STOCK', `재고 부족: ${sku} (남은 ${p.stock}, 요청 ${qty})`)
    p.stock -= qty
  }

  function release(sku, qty) {
    load(sku).stock += qty
  }

  function restock(sku, qty) {
    if (!Number.isInteger(qty) || qty <= 0) fail('BAD_QTY', `입고 수량: ${qty}`)
    load(sku).stock += qty
  }

  return { add, get, find, list, setPrice, discontinue, reserve, release, restock }
}
