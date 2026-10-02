// 설정 합치기. 배열과 원시값은 덮어쓰고, 평범한 객체는 재귀로 합친다.

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
}

export function deepMerge(base, override) {
  if (override === undefined) return clone(base)
  if (!isPlainObject(base) || !isPlainObject(override)) return clone(override)
  const out = clone(base)
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue
    out[key] = key in out ? deepMerge(out[key], value) : clone(value)
  }
  return out
}

export function clone(value) {
  if (Array.isArray(value)) return value.map(clone)
  if (isPlainObject(value)) {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = clone(v)
    return out
  }
  return value
}

export function deepFreeze(value) {
  if (Array.isArray(value) || isPlainObject(value)) {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}
