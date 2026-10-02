// 수신한 이벤트의 중복 제거.
import { dedupeKey } from './key.js'
import { createTtlStore } from './store.js'

export function createDeduper({ clock, windowMs, maxEntries }) {
  const store = createTtlStore({ clock, ttlMs: windowMs, maxEntries })
  const stats = { checked: 0, duplicates: 0 }

  return {
    /** 이미 본 이벤트면 true. 처음 보면 기록하고 false */
    checkAndMark(event) {
      const key = dedupeKey(event)
      stats.checked++
      if (store.has(key)) {
        stats.duplicates++
        return true
      }
      store.add(key)
      return false
    },
    /** 처리하다 거절된 이벤트는 다시 받을 수 있게 지운다 */
    forget(event) {
      store.delete(dedupeKey(event))
    },
    size: () => store.size(),
    stats: () => ({ ...stats }),
  }
}
