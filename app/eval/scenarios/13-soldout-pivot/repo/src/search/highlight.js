// 상품 이름에서 검색어 단어를 태그로 감싼다.

import { synonymsOf } from '../text/synonyms.js'

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])
}

// 겹치거나 붙은 구간을 합친다
function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out = []
  for (const r of sorted) {
    const last = out.at(-1)
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else out.push([...r])
  }
  return out
}

export function findRanges(text, terms) {
  const lower = text.toLowerCase()
  const ranges = []
  for (const term of terms) {
    if (!term) continue
    let from = 0
    for (;;) {
      const at = lower.indexOf(term, from)
      if (at < 0) break
      ranges.push([at, at + term.length])
      from = at + term.length
    }
  }
  return mergeRanges(ranges)
}

export function highlight(text, terms, { open = '<em>', close = '</em>', synonyms = true } = {}) {
  const all = synonyms ? [...terms, ...terms.flatMap(synonymsOf)] : terms
  const ranges = findRanges(text, all)
  let out = ''
  let pos = 0
  for (const [start, end] of ranges) {
    out += escapeHtml(text.slice(pos, start)) + open + escapeHtml(text.slice(start, end)) + close
    pos = end
  }
  return out + escapeHtml(text.slice(pos))
}
