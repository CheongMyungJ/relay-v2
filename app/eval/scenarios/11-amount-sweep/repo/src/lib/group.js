// 배열 묶기와 합계. 리포트들이 같이 쓴다

export function groupBy(list, keyOf) {
  const out = new Map()
  for (const item of list) {
    const key = keyOf(item)
    const bucket = out.get(key)
    if (bucket) bucket.push(item)
    else out.set(key, [item])
  }
  return out
}

export function sumBy(list, valueOf) {
  let total = 0
  for (const item of list) total += valueOf(item)
  return total
}

export function sortBy(list, ...keys) {
  return [...list].sort((a, b) => {
    for (const key of keys) {
      const desc = key.startsWith('-')
      const name = desc ? key.slice(1) : key
      const x = a[name]
      const y = b[name]
      if (x === y) continue
      const cmp = x < y ? -1 : 1
      return desc ? -cmp : cmp
    }
    return 0
  })
}

export function topN(list, n) {
  if (!n || n <= 0) return [...list]
  return list.slice(0, n)
}

export function countBy(list, keyOf) {
  const out = {}
  for (const item of list) {
    const key = keyOf(item)
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}
