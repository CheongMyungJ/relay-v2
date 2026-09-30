/**
 * 메모리 테이블. 운영에서는 DB 앞에 같은 인터페이스를 둔다.
 * 행은 넣을 때와 꺼낼 때 복사한다. 읽기와 쓰기 수를 센다.
 */
export function createTable(name, keyOf) {
  const rows = new Map()
  const counters = { reads: 0, writes: 0 }
  const copy = (row) => (row ? structuredClone(row) : null)

  return {
    name,
    get(key) {
      counters.reads++
      return copy(rows.get(key))
    },
    put(row) {
      counters.writes++
      rows.set(keyOf(row), copy(row))
      return copy(row)
    },
    delete(key) {
      counters.writes++
      return rows.delete(key)
    },
    scan(filter = () => true) {
      counters.reads++
      return [...rows.values()].filter(filter).map(copy)
    },
    count() {
      return rows.size
    },
    stats() {
      return { ...counters }
    },
  }
}

const stockKeyOf = (sku, warehouse) => `${sku}|${warehouse}`

/**
 * 창고별 재고 레코드 테이블.
 * 레코드: { sku, warehouse, onHand, reserved, updatedAt }
 */
export function createStockTable() {
  const table = createTable('stock', (r) => stockKeyOf(r.sku, r.warehouse))

  return {
    get(sku, warehouse) {
      return table.get(stockKeyOf(sku, warehouse))
    },
    put(record) {
      if (!Number.isInteger(record.onHand) || !Number.isInteger(record.reserved)) {
        throw new Error(`재고 레코드 수량이 정수가 아님: ${JSON.stringify(record)}`)
      }
      return table.put(record)
    },
    listBySku(sku) {
      return table.scan((r) => r.sku === sku)
    },
    all() {
      return table.scan()
    },
    count: () => table.count(),
    stats: () => table.stats(),
  }
}
