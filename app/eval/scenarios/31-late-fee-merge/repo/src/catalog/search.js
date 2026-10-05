import { CATEGORIES, listTools } from './tools.js'

function norm(s) {
  return String(s).toLowerCase().replace(/\s+/g, '')
}

/** 이름이나 분류 이름에 q가 들어간 공구. sort: 'price'(싼 차례) | 'name' */
export function searchTools(q, { sort = 'name' } = {}) {
  const needle = norm(q ?? '')
  const found = listTools().filter(
    (t) => norm(t.name).includes(needle) || norm(CATEGORIES[t.category] ?? '').includes(needle),
  )
  if (sort === 'price') return found.sort((a, b) => a.dailyRate - b.dailyRate || a.id.localeCompare(b.id))
  return found.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}
