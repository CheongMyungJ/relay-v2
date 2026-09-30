// 상품 분류. id는 'kitchen/tumbler'처럼 '/'로 이어 쓴다.

const LABELS = {
  kitchen: '주방',
  'kitchen/tumbler': '텀블러',
  'kitchen/mug': '머그',
  'kitchen/cookware': '조리도구',
  outdoor: '아웃도어',
  'outdoor/camping': '캠핑',
  'outdoor/bottle': '물병',
  fashion: '패션',
  'fashion/shoes': '신발',
  'fashion/top': '상의',
  digital: '디지털',
  'digital/audio': '음향',
  'digital/computer': '컴퓨터',
  etc: '기타',
}

export function categoryLabel(id) {
  return LABELS[id] ?? id
}

// 'kitchen/tumbler' → ['kitchen', 'kitchen/tumbler']
export function categoryPath(id) {
  const parts = String(id).split('/').filter(Boolean)
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
}

// 상품 분류가 filter 분류이거나 그 아래인지
export function isInCategory(productCategory, filterCategory) {
  if (!filterCategory) return true
  const want = String(filterCategory).replace(/\/+$/, '')
  return productCategory === want || String(productCategory).startsWith(`${want}/`)
}

// 색인할 분류 글: 경로마다 이름을 붙인다. 'kitchen/tumbler' → '주방 텀블러'
export function categoryText(id) {
  return categoryPath(id).map(categoryLabel).join(' ')
}

export function knownCategories() {
  return Object.keys(LABELS)
}
