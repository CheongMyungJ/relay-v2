// 고정폭 터미널에서 한글은 두 칸을 차지한다. 표를 맞추려고 폭을 따로 센다

function isWide(code) {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  )
}

export function displayWidth(text) {
  let width = 0
  for (const ch of String(text)) width += isWide(ch.codePointAt(0)) ? 2 : 1
  return width
}

export function padEndWidth(text, width, fill = ' ') {
  const s = String(text)
  const gap = width - displayWidth(s)
  return gap > 0 ? s + fill.repeat(gap) : s
}

export function padStartWidth(text, width, fill = ' ') {
  const s = String(text)
  const gap = width - displayWidth(s)
  return gap > 0 ? fill.repeat(gap) + s : s
}

export function truncateWidth(text, width, ellipsis = '…') {
  const s = String(text)
  if (displayWidth(s) <= width) return s
  let out = ''
  let used = 0
  const room = width - displayWidth(ellipsis)
  for (const ch of s) {
    const w = isWide(ch.codePointAt(0)) ? 2 : 1
    if (used + w > room) break
    out += ch
    used += w
  }
  return out + ellipsis
}

export function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

// 폭에 맞춰 줄 바꾸기. 낱말(공백 기준)을 쪼개지 않는다
export function wrapWidth(text, width) {
  const lines = []
  let line = ''
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && displayWidth(next) > width) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}
