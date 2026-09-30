// 리포트 결과를 JSON으로. Map은 객체로 바꾸고 키 순서를 고정해 비교하기 쉽게 한다
function normalize(value) {
  if (value instanceof Map) return normalize(Object.fromEntries(value))
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = normalize(value[key])
    return out
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null
  return value
}

export function toJson(report, { pretty = true } = {}) {
  return JSON.stringify(normalize(report), null, pretty ? 2 : 0) + '\n'
}
