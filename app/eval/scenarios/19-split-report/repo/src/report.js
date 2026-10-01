// 지출 보고서: CSV 글(date,category,amount)을 읽어 분류별 합계를 금액이 큰 차례로 낸다.
// 밖에서는 buildReport(text)만 쓴다 (월말 정산 스크립트).
export function buildReport(text) {
  const lines = text.trim().split('\n')
  const header = lines[0].split(',').map((h) => h.trim())
  const rows = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = line.split(',')
    const row = {}
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim()
    })
    rows.push({ date: row.date, category: row.category, amount: Number(row.amount) })
  }

  const totals = new Map()
  for (const row of rows) {
    if (!row.amount) continue
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount)
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const width = Math.max(4, ...sorted.map(([c]) => c.length))
  const out = sorted.map(([c, t]) => `${c.padEnd(width)} ${t.toLocaleString('en-US')}`)
  const sum = sorted.reduce((a, [, t]) => a + t, 0)
  out.push(`${'합계'.padEnd(width)} ${sum.toLocaleString('en-US')}`)
  return out.join('\n')
}
