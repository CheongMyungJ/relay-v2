import { inRange } from '../lib/dates.js'
import { accountType } from './accounts.js'

// 행 거르기. 조건이 없으면 그 조건은 보지 않는다
export function filterRows(rows, { from, to, accounts, types, categories, vendor } = {}) {
  const accountSet = accounts && new Set(accounts.map(String))
  const typeSet = types && new Set(types)
  const categorySet = categories && new Set(categories)
  return rows.filter((row) => {
    if ((from || to) && !inRange(row.date, from, to)) return false
    if (accountSet && !accountSet.has(row.account)) return false
    if (typeSet && !typeSet.has(accountType(row.account))) return false
    if (categorySet && !categorySet.has(row.category)) return false
    if (vendor && !String(row.vendor).includes(vendor)) return false
    return true
  })
}

export function distinct(rows, field) {
  return [...new Set(rows.map((r) => r[field]).filter(Boolean))].sort()
}
