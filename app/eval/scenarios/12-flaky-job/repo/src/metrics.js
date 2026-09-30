// 간단한 지표: 세기(counter)와 관측값(observation)

export function createMetrics() {
  const counters = new Map()
  const series = new Map()

  return {
    increment(name, by = 1) {
      counters.set(name, (counters.get(name) ?? 0) + by)
    },
    observe(name, value) {
      if (!Number.isFinite(value)) return
      if (!series.has(name)) series.set(name, [])
      series.get(name).push(value)
    },
    count(name) {
      return counters.get(name) ?? 0
    },
    /** 관측값 통계: 개수, 합, 평균, 최대 */
    stats(name) {
      const values = series.get(name) ?? []
      const sum = values.reduce((a, b) => a + b, 0)
      return {
        count: values.length,
        sum,
        mean: values.length ? sum / values.length : 0,
        max: values.length ? Math.max(...values) : 0,
      }
    },
    /** 지금까지의 모든 값 */
    snapshot() {
      const out = { counters: Object.fromEntries(counters), series: {} }
      for (const name of series.keys()) out.series[name] = this.stats(name)
      return out
    },
    reset() {
      counters.clear()
      series.clear()
    },
  }
}
