// 검색 엔진 설정. createSearch(products, overrides)에 넘긴 값이 기본값을 덮는다.

export const DEFAULTS = Object.freeze({
  // 한 쪽에 보여 줄 결과 수
  pageSize: 20,
  // 한 쪽 최대 크기. 이보다 크게 달라고 하면 잘라 낸다
  maxPageSize: 100,
  // 필드별 가중치. 이름에서 찾은 단어가 설명에서 찾은 단어보다 무겁다
  fieldWeights: Object.freeze({ name: 3, brand: 2, tags: 1.5, category: 1, description: 0.5 }),
  // BM25 매개변수
  bm25: Object.freeze({ k1: 1.2, b: 0.75 }),
  // 인기도(최근 30일 판매량) 가산점 가중치
  popularityWeight: 0.4,
  // 동의어 확장 여부와 동의어 가중치
  synonyms: true,
  synonymWeight: 0.5,
  // 검색어 하이라이트 태그
  highlight: Object.freeze({ open: '<em>', close: '</em>' }),
  // 로그 수준: debug | info | warn | error | silent
  logLevel: 'warn',
})

export function resolveConfig(overrides = {}) {
  const out = { ...DEFAULTS, ...overrides }
  out.fieldWeights = { ...DEFAULTS.fieldWeights, ...(overrides.fieldWeights ?? {}) }
  out.bm25 = { ...DEFAULTS.bm25, ...(overrides.bm25 ?? {}) }
  out.highlight = { ...DEFAULTS.highlight, ...(overrides.highlight ?? {}) }
  if (!Number.isInteger(out.pageSize) || out.pageSize < 1) {
    throw new RangeError(`pageSize는 1 이상의 정수여야 한다: ${out.pageSize}`)
  }
  if (out.pageSize > out.maxPageSize) out.pageSize = out.maxPageSize
  for (const [field, weight] of Object.entries(out.fieldWeights)) {
    if (!(weight >= 0)) throw new RangeError(`필드 가중치가 잘못됐다: ${field}=${weight}`)
  }
  return out
}
