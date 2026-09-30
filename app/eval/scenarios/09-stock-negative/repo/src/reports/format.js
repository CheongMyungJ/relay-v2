/** 고정폭 글꼴에서 한글과 전각 문자는 두 칸을 차지한다 */
export function displayWidth(text) {
  let width = 0
  for (const ch of String(text)) {
    const code = ch.codePointAt(0)
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60)
    width += wide ? 2 : 1
  }
  return width
}

export function pad(text, width, align = 'left') {
  const s = String(text)
  const gap = Math.max(0, width - displayWidth(s))
  return align === 'right' ? ' '.repeat(gap) + s : s + ' '.repeat(gap)
}

export function formatNumber(n) {
  return n.toLocaleString('ko-KR')
}

/**
 * 글자 표. columns: [{ title, key, align?, format? }]
 */
export function renderTable(columns, rows) {
  const cells = rows.map((row) => columns.map((c) => (c.format ? c.format(row[c.key], row) : String(row[c.key] ?? ''))))
  const widths = columns.map((c, i) => Math.max(displayWidth(c.title), ...cells.map((r) => displayWidth(r[i]))))
  const line = (values) =>
    values
      .map((v, i) => pad(v, widths[i], columns[i].align))
      .join('  ')
      .trimEnd()
  const header = line(columns.map((c) => c.title))
  const rule = widths.map((w) => '-'.repeat(w)).join('  ').trimEnd()
  return [header, rule, ...cells.map(line)].join('\n')
}

/** 한국 시간 'YYYY-MM-DD HH:mm' */
export function formatKst(date) {
  const local = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return local.toISOString().slice(0, 16).replace('T', ' ')
}
