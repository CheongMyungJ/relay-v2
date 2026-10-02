// 메모리 지표: 카운터와 분포.

export function createMetrics() {
  const counters = new Map()
  const histograms = new Map()

  return {
    increment(name, by = 1) {
      counters.set(name, (counters.get(name) ?? 0) + by)
    },
    observe(name, value) {
      const h = histograms.get(name) ?? { count: 0, sum: 0, min: Infinity, max: -Infinity, values: [] }
      h.count++
      h.sum += value
      h.min = Math.min(h.min, value)
      h.max = Math.max(h.max, value)
      h.values.push(value)
      if (h.values.length > 1000) h.values.shift()
      histograms.set(name, h)
    },
    /** clock으로 걸린 시간을 재서 observe한다. 돌려준 함수를 부르면 기록한다 */
    startTimer(name, clock) {
      const started = clock.now()
      return () => {
        const ms = clock.now() - started
        this.observe(name, ms)
        return ms
      }
    },
    counter: (name) => counters.get(name) ?? 0,
    histogram(name) {
      const h = histograms.get(name)
      if (!h) return null
      return { count: h.count, sum: h.sum, min: h.min, max: h.max, mean: h.sum / h.count, p95: percentile(h.values, 95) }
    },
    snapshot() {
      const out = { counters: Object.fromEntries(counters), histograms: {} }
      for (const name of histograms.keys()) out.histograms[name] = this.histogram(name)
      return out
    },
    reset() {
      counters.clear()
      histograms.clear()
    },
  }
}

export function percentile(values, p) {
  if (!values.length) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))]
}
