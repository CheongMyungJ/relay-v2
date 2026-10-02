// cleanup 작업: 저장소에서 기한이 지난 항목을 지운다.
import { now } from '../clock.js'

/**
 * @param {{ store: { entries: () => Iterable<[string, { expiresAt?: number }]>, delete: (key: string) => boolean } }} deps
 */
export function createCleanupHandler({ store }) {
  return async function cleanup(payload = {}) {
    const prefix = payload.prefix ?? ''
    const at = payload.at ?? now()
    const limit = payload.limit ?? Number.POSITIVE_INFINITY
    const expired = []
    for (const [key, entry] of store.entries()) {
      if (expired.length >= limit) break
      if (!key.startsWith(prefix)) continue
      if (entry.expiresAt !== undefined && entry.expiresAt <= at) expired.push(key)
    }
    for (const key of expired) store.delete(key)
    return { prefix, removed: expired.length }
  }
}
