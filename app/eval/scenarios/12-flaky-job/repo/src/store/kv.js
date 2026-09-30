// 기한(expiresAt)을 둘 수 있는 메모리 키-값 저장소
import { now } from '../clock.js'

export class KvStore {
  constructor() {
    this.map = new Map()
  }

  /** ttlMs를 주면 그만큼 뒤에 기한이 끝난다 */
  set(key, value, { ttlMs } = {}) {
    const entry = { value }
    if (ttlMs !== undefined) entry.expiresAt = now() + ttlMs
    this.map.set(key, entry)
    return this
  }

  /** 기한이 지난 값은 없는 것으로 본다(지우지는 않는다. 지우는 것은 cleanup 작업) */
  get(key) {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (entry.expiresAt !== undefined && entry.expiresAt <= now()) return undefined
    return entry.value
  }

  has(key) {
    return this.get(key) !== undefined
  }

  delete(key) {
    return this.map.delete(key)
  }

  entries() {
    return this.map.entries()
  }

  get size() {
    return this.map.size
  }
}
