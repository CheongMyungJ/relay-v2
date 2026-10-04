// CSV 만들기. 엑셀에서 한글이 깨지지 않게 BOM을 붙일 수 있다

export function escapeCsv(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

// columns: [{ key, header }] 또는 [{ header, get(row) }]
export function toCsv(rows, columns, { bom = false, eol = '\r\n' } = {}) {
  const head = columns.map((c) => escapeCsv(c.header)).join(',')
  const body = rows.map((row) =>
    columns.map((c) => escapeCsv(c.get ? c.get(row) : row[c.key])).join(','),
  )
  const text = [head, ...body].join(eol) + eol
  return bom ? `﻿${text}` : text
}

// 한 줄을 칸으로 나눈다 (가져오기 확인용)
export function parseCsvLine(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}
