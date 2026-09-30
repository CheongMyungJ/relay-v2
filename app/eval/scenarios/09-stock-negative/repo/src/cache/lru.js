/**
 * 크기와 수명이 있는 LRU 캐시.
 * Map의 삽입 순서를 최근 사용 순서로 쓴다(맨 앞이 가장 오래 안 쓴 것).
 */
export function createLru({ maxEntries = 500, ttlMs = 0, now = () => Date.now() } = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries <= 0) throw new Error(`maxEntries가 잘못됨: ${maxEntries}`)
  const map = new Map()
  const counters = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0, expired: 0 }

  function expired(entry) {
    return ttlMs > 0 && now() - entry.at >= ttlMs
  }

  function get(key) {
    const entry = map.get(key)
    if (!entry) {
      counters.misses++
      return undefined
    }
    if (expired(entry)) {
      map.delete(key)
      counters.expired++
      counters.misses++
      return undefined
    }
    map.delete(key)
    map.set(key, entry)
    counters.hits++
    return entry.value
  }

  function has(key) {
    const entry = map.get(key)
    return !!entry && !expired(entry)
  }

  function set(key, value) {
    if (map.has(key)) map.delete(key)
    map.set(key, { value, at: now() })
    counters.sets++
    while (map.size > maxEntries) {
      const oldest = map.keys().next().value
      map.delete(oldest)
      counters.evictions++
    }
  }

  function del(key) {
    const existed = map.delete(key)
    if (existed) counters.deletes++
    return existed
  }

  function clear() {
    map.clear()
  }

  function stats() {
    const lookups = counters.hits + counters.misses
    return { ...counters, size: map.size, hitRate: lookups ? counters.hits / lookups : 0 }
  }

  function resetStats() {
    for (const k of Object.keys(counters)) counters[k] = 0
  }

  return { get, has, set, delete: del, clear, stats, resetStats, keys: () => [...map.keys()] }
}
