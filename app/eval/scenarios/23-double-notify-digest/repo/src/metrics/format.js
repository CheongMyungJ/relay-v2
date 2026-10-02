// 지표를 텍스트로 내보낸다(수집기가 긁어 가는 형식).

function metricName(name) {
  return `notify_${name.replace(/[^a-zA-Z0-9]+/g, '_')}`
}

export function formatMetrics(snapshot) {
  const lines = []
  for (const [name, value] of Object.entries(snapshot.counters).sort()) {
    lines.push(`# TYPE ${metricName(name)} counter`)
    lines.push(`${metricName(name)} ${value}`)
  }
  for (const [name, h] of Object.entries(snapshot.histograms).sort()) {
    const base = metricName(name)
    lines.push(`# TYPE ${base} summary`)
    lines.push(`${base}_count ${h.count}`)
    lines.push(`${base}_sum ${h.sum}`)
    lines.push(`${base}{quantile="0.95"} ${h.p95}`)
  }
  return lines.join('\n') + '\n'
}
