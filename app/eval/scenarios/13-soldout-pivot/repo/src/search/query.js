// 검색어 해석
//   '텀블러 brand:스탠리 price:1만-5만 -캠핑 ㅌㅂㄹ'
//   → 일반 단어, 필터 표기, 뺄 단어(-), 초성 단어로 나눈다.
//   '"클래식 텀블러"'처럼 따옴표로 감싼 구절은 이름이나 설명에 붙어서 나와야 한다.

import { parseKRW } from '../util/money.js'
import { isChoseongOnly } from '../text/hangul.js'
import { normalize } from '../text/normalize.js'
import { tokenize } from '../text/tokenize.js'

const FILTER_KEYS = {
  brand: 'brand',
  브랜드: 'brand',
  category: 'category',
  분류: 'category',
  price: 'price',
  가격: 'price',
  tag: 'tag',
  태그: 'tag',
}

// '10000-30000', '1만-3만', '<30000', '>10000', '-30000', '10000-'
export function parsePriceRange(text) {
  const s = String(text).trim()
  let m = /^([<>])=?(.+)$/.exec(s)
  if (m) {
    const v = parseKRW(m[2])
    if (!Number.isFinite(v)) return null
    return m[1] === '<' ? { maxPrice: v } : { minPrice: v }
  }
  m = /^(.*)-(.*)$/.exec(s)
  if (!m) return null
  const range = {}
  if (m[1] !== '') range.minPrice = parseKRW(m[1])
  if (m[2] !== '') range.maxPrice = parseKRW(m[2])
  if (Object.values(range).some((v) => !Number.isFinite(v)) || Object.keys(range).length === 0) return null
  return range
}

function applyFilterToken(filters, key, value) {
  if (key === 'price') {
    const range = parsePriceRange(value)
    if (range) Object.assign(filters, range)
    return
  }
  filters[key] = value
}

// 따옴표 구절을 떼어 낸다: [구절 목록, 남은 글]
function extractPhrases(text) {
  const phrases = []
  const rest = text.replace(/"([^"]+)"/g, (_, inner) => {
    const phrase = normalize(inner)
    if (phrase) phrases.push(phrase)
    return ` ${inner} `
  })
  return [phrases, rest]
}

export function parseQuery(raw) {
  const text = String(raw ?? '').trim()
  const [phrases, rest] = extractPhrases(text)
  const filters = {}
  const words = []
  const initials = []
  const excluded = []
  for (const part of rest.split(/\s+/).filter(Boolean)) {
    const m = /^([^:]+):(.+)$/.exec(part)
    const key = m && FILTER_KEYS[m[1].toLowerCase()]
    if (key) {
      applyFilterToken(filters, key, m[2])
    } else if (part.startsWith('-') && part.length > 1) {
      excluded.push(...tokenize(part.slice(1)))
    } else if (isChoseongOnly(part)) {
      initials.push(part)
    } else {
      words.push(part)
    }
  }
  return { raw: text, terms: tokenize(words.join(' ')), phrases, initials, excluded, filters }
}

// 검색어가 아무것도 고르지 않는지(빈 검색어로 전체 둘러보기)
export function isBrowse(parsed) {
  return parsed.terms.length === 0 && parsed.initials.length === 0
}
