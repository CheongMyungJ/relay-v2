// 내부 id. 접두어마다 1부터 센다(시험에서 예측할 수 있게).

export function createIds() {
  const counters = new Map()
  return {
    next(prefix) {
      const n = (counters.get(prefix) ?? 0) + 1
      counters.set(prefix, n)
      return `${prefix}-${n}`
    },
  }
}
