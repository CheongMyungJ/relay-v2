// 고정폭 글꼴에서 한글은 두 칸을 차지한다. 서식의 열을 맞출 때 쓴다

function isWide(code) {
  return (
    (code >= 0x1100 && code <= 0x115f) || // 한글 자모
    (code >= 0x2e80 && code <= 0xa4cf) || // CJK
    (code >= 0xac00 && code <= 0xd7a3) || // 한글 음절
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) || // 전각 문자
    (code >= 0xffe0 && code <= 0xffe6)
  )
}

export function displayWidth(text) {
  let w = 0
  for (const ch of String(text)) w += isWide(ch.codePointAt(0)) ? 2 : 1
  return w
}

export function padEndW(text, width) {
  const s = String(text)
  return s + ' '.repeat(Math.max(0, width - displayWidth(s)))
}

export function padStartW(text, width) {
  const s = String(text)
  return ' '.repeat(Math.max(0, width - displayWidth(s))) + s
}

export function centerW(text, width) {
  const s = String(text)
  const space = Math.max(0, width - displayWidth(s))
  const left = Math.floor(space / 2)
  return ' '.repeat(left) + s + ' '.repeat(space - left)
}

// 폭을 넘으면 자르고 '…'를 붙인다. '…'도 한 칸으로 센다
export function truncateW(text, width) {
  const s = String(text)
  if (displayWidth(s) <= width) return s
  let out = ''
  let w = 0
  for (const ch of s) {
    const cw = isWide(ch.codePointAt(0)) ? 2 : 1
    if (w + cw > width - 1) break
    out += ch
    w += cw
  }
  return `${out}…`
}
