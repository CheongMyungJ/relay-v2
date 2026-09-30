import { toIso } from '../lib/dates.js'
import { normalizeVendor } from '../vendors/normalize.js'

// 같은 거래가 두 번 들어간 것 같은 행 찾기. 날짜, 계정, 거래처, 금액 글자가 모두 같으면 의심한다
// 금액은 숫자로 읽지 않고 적힌 글자에서 공백만 빼고 비교한다
function fingerprint(row) {
  return [
    toIso(row.date) ?? row.date,
    row.account,
    normalizeVendor(row.vendor),
    String(row.amount ?? '').replace(/\s+/g, ''),
  ].join('|')
}

export function findDuplicates(rows) {
  const seen = new Map()
  const groups = []
  rows.forEach((row, index) => {
    const key = fingerprint(row)
    const first = seen.get(key)
    if (first === undefined) {
      seen.set(key, [index])
    } else {
      first.push(index)
    }
  })
  for (const [key, indexes] of seen) {
    if (indexes.length > 1) groups.push({ key, indexes })
  }
  return groups
}

export function dropDuplicates(rows) {
  const drop = new Set()
  for (const g of findDuplicates(rows)) for (const i of g.indexes.slice(1)) drop.add(i)
  return rows.filter((_, i) => !drop.has(i))
}
