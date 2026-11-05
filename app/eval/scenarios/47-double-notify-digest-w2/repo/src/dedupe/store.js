// 만료 시간이 있는 키 모음. 오래된 것부터 지운다.

export function createTtlStore({ clock, ttlMs, maxEntries = Infinity }) {
  // Map은 넣은 순서를 지키므로 앞쪽이 가장 오래된 키다
  const entries = new Map()

  function prune() {
    const now = clock.now()
    for (const [key, expiresAt] of entries) {
      if (expiresAt > now) break
      entries.delete(key)
    }
  }

  return {
    has(key) {
      const expiresAt = entries.get(key)
      if (expiresAt === undefined) return false
      if (expiresAt <= clock.now()) {
        entries.delete(key)
        return false
      }
      return true
    },
    add(key) {
      prune()
      entries.delete(key)
      entries.set(key, clock.now() + ttlMs)
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value)
    },
    delete: (key) => entries.delete(key),
    size() {
      prune()
      return entries.size
    },
    clear: () => entries.clear(),
  }
}
