// 동의어. 검색어 단어를 같은 뜻의 단어로 넓힌다. 넓힌 단어는 가중치를 낮춘다.

const GROUPS = [
  ['텀블러', '보온병', '보틀'],
  ['머그', '머그컵'],
  ['노트북', '랩탑'],
  ['이어폰', '이어버드'],
  ['운동화', '스니커즈'],
  ['후드', '후드티', '후디'],
  ['캠핑', '캠프'],
]

const BY_TERM = new Map()
for (const group of GROUPS) {
  for (const term of group) BY_TERM.set(term, group.filter((t) => t !== term))
}

export function synonymsOf(term) {
  return BY_TERM.get(term) ?? []
}

// [{ term, weight, origin }] 원래 단어는 weight 1
export function expandTerms(terms, { enabled = true, weight = 0.5 } = {}) {
  const out = []
  const seen = new Set()
  for (const term of terms) {
    if (!seen.has(term)) {
      seen.add(term)
      out.push({ term, weight: 1, origin: term })
    }
  }
  if (!enabled) return out
  for (const term of terms) {
    for (const syn of synonymsOf(term)) {
      if (seen.has(syn)) continue
      seen.add(syn)
      out.push({ term: syn, weight, origin: term })
    }
  }
  return out
}
