import { createCustomer, normalizeBizNo } from './customer.js'

// 메모리에 두는 고객 목록. 실제 서비스에서는 DB 어댑터가 같은 모양을 따른다
export function createCustomerStore(initial = []) {
  const byId = new Map()

  const store = {
    add(data) {
      const customer = createCustomer(data)
      if (byId.has(customer.id)) throw new Error(`이미 있는 고객 ID: ${customer.id}`)
      if (store.findByBizNo(customer.bizNo)) throw new Error(`이미 등록된 사업자등록번호: ${customer.bizNo}`)
      byId.set(customer.id, customer)
      return customer
    },
    get(id) {
      return byId.get(id) ?? null
    },
    require(id) {
      const c = byId.get(id)
      if (!c) throw new Error(`고객을 찾지 못함: ${id}`)
      return c
    },
    findByBizNo(bizNo) {
      const wanted = normalizeBizNo(bizNo)
      for (const c of byId.values()) if (c.bizNo === wanted) return c
      return null
    },
    // 이름 일부로 찾는다. 대소문자와 공백을 무시한다
    search(text) {
      const q = String(text).toLowerCase().replace(/\s+/g, '')
      return store.list().filter((c) => c.name.toLowerCase().replace(/\s+/g, '').includes(q))
    },
    update(id, patch) {
      const current = store.require(id)
      if (patch.id && patch.id !== id) throw new Error('고객 ID는 바꿀 수 없다')
      const next = createCustomer({ ...current, ...patch, id })
      const other = store.findByBizNo(next.bizNo)
      if (other && other.id !== id) throw new Error(`이미 등록된 사업자등록번호: ${next.bizNo}`)
      byId.set(id, next)
      return next
    },
    remove(id) {
      return byId.delete(id)
    },
    list() {
      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    },
    get size() {
      return byId.size
    },
  }

  for (const data of initial) store.add(data)
  return store
}
