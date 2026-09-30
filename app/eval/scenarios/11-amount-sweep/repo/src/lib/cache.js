// 작은 LRU 캐시. 같은 원장 파일로 리포트 여러 개를 뽑을 때 읽기 결과를 다시 쓴다
export class LruCache {
  constructor(limit = 50) {
    if (!(limit > 0)) throw new Error('limit은 1 이상')
    this.limit = limit
    this.map = new Map()
    this.hits = 0
    this.misses = 0
  }

  get(key) {
    if (!this.map.has(key)) {
      this.misses++
      return undefined
    }
    const value = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, value)
    this.hits++
    return value
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.limit) this.map.delete(this.map.keys().next().value)
    return this
  }

  has(key) {
    return this.map.has(key)
  }

  get size() {
    return this.map.size
  }

  clear() {
    this.map.clear()
    this.hits = 0
    this.misses = 0
  }
}

// 인자 하나짜리 함수를 캐시로 감싼다. key는 인자에서 캐시 키를 만든다
export function memoize(fn, { limit = 50, key = (x) => x } = {}) {
  const cache = new LruCache(limit)
  const wrapped = (arg) => {
    const k = key(arg)
    if (cache.has(k)) return cache.get(k)
    const value = fn(arg)
    cache.set(k, value)
    return value
  }
  wrapped.cache = cache
  return wrapped
}
