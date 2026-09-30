// 문자열을 검색 단어로 쪼갠다. 색인과 검색어가 같은 규칙을 써야 한다.

import { hasHangul, normalize } from './normalize.js'

// 검색에 도움이 안 되는 단어
const STOPWORDS = new Set(['및', '용', '의', '등', 'the', 'a', 'an', 'of', 'for', 'and', 'with', 'in'])

export function isStopword(token) {
  return STOPWORDS.has(token)
}

// 흔한 조사 몇 개만 뗀다. 두 글자 이하 단어는 건드리지 않는다(예: '도마', '포도')
const PARTICLES = ['으로', '에서', '은', '는', '을', '를', '의']

export function stripParticle(token) {
  if (token.length <= 2 || !hasHangul(token)) return token
  for (const p of PARTICLES) {
    if (token.endsWith(p) && token.length - p.length >= 2) return token.slice(0, -p.length)
  }
  return token
}

// '스탠리 클래식 텀블러 1L' → ['스탠리', '클래식', '텀블러', '1l']
export function tokenize(text, { keepStopwords = false } = {}) {
  const out = []
  for (const raw of normalize(text).split(' ')) {
    if (!raw) continue
    const token = stripParticle(raw)
    if (!keepStopwords && isStopword(token)) continue
    out.push(token)
  }
  return out
}

// 중복을 뺀 단어 목록(순서 유지)
export function uniqueTokens(text) {
  return [...new Set(tokenize(text))]
}
