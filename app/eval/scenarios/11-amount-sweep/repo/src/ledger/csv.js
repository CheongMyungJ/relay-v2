// CSV 한 줄 나누기. 큰따옴표로 감싼 칸 안의 쉼표와 "" 이스케이프를 처리한다

export function splitLines(text) {
  const s = String(text).replace(/^﻿/, '')
  const lines = []
  let buf = ''
  let quoted = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '"') quoted = !quoted
    if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && s[i + 1] === '\n') i++
      lines.push(buf)
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf !== '') lines.push(buf)
  return lines
}

export function parseCsvLine(line, sep = ',') {
  const cells = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === sep) {
      cells.push(cell)
      cell = ''
    } else {
      cell += ch
    }
  }
  cells.push(cell)
  return cells
}

export function detectSeparator(headerLine) {
  const counts = { ',': 0, '\t': 0, ';': 0 }
  for (const ch of headerLine) if (ch in counts) counts[ch]++
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}
