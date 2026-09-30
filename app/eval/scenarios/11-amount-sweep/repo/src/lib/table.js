import { displayWidth, padEndWidth, padStartWidth, truncateWidth } from '../util/strings.js'

// 글자 표. columns: [{ key, title, align: 'left' | 'right', max }]
export function renderTable(columns, rows) {
  const cells = rows.map((row) =>
    columns.map((col) => {
      const raw = row[col.key] ?? ''
      const text = col.format ? col.format(raw, row) : String(raw)
      return col.max ? truncateWidth(text, col.max) : text
    }),
  )
  const widths = columns.map((col, i) =>
    Math.max(displayWidth(col.title), ...cells.map((r) => displayWidth(r[i])), 1),
  )
  const line = (values) =>
    values
      .map((v, i) =>
        columns[i].align === 'right' ? padStartWidth(v, widths[i]) : padEndWidth(v, widths[i]),
      )
      .join('  ')
      .trimEnd()
  const header = line(columns.map((c) => c.title))
  const rule = widths.map((w) => '-'.repeat(w)).join('  ')
  return [header, rule, ...cells.map(line)].join('\n')
}
