// 검색 엔진. 흐름:
//   검색어 해석 → 후보 고르기 → 점수 → 필터 → 정렬 → 페이지 나누기 → 쪽 훅과 표시

import { normalizeCatalog } from '../catalog/product.js'
import { resolveConfig } from '../config.js'
import { createLogger } from '../log/logger.js'
import { nullSink } from '../log/sinks.js'
import { applyFilters, describeFilters, facetCounts, mergeFilters } from './filters.js'
import { BUILTIN_HOOKS, createHooks } from './hooks.js'
import { buildIndex, indexStats, suggestTerms } from './indexer.js'
import { matchDocs } from './match.js'
import { paginate } from './paginate.js'
import { present } from './present.js'
import { parseQuery } from './query.js'
import { explainScore, scoreHits } from './score.js'
import { sortHits } from './sort.js'

// 이보다 오래 걸린 검색은 warn으로 남긴다(ms)
const SLOW_QUERY_MS = 50

export function createSearch(products, overrides = {}) {
  const config = resolveConfig(overrides)
  const log = (overrides.logger ?? createLogger({ scope: 'search', level: config.logLevel, sink: nullSink })).child('engine')
  const catalog = normalizeCatalog(products)
  const index = buildIndex(catalog)
  const hooks = createHooks(BUILTIN_HOOKS)
  log.info('색인 완료', indexStats(index))

  // search('텀블러', { page: 2, pageSize: 10, sort: 'relevance', filters: { brand: '스탠리' } })
  function search(query, options = {}) {
    const started = Date.now()
    const parsed = parseQuery(query)
    const sort = options.sort ?? 'relevance'
    const filters = mergeFilters(parsed.filters, options.filters)

    const ids = matchDocs(index, parsed, { synonyms: config.synonyms })
    const scored = scoreHits(index, ids, parsed, config)
    const filtered = applyFilters(scored, filters)
    const sorted = sortHits(filtered, sort)
    const page = paginate(
      sorted,
      { page: options.page, pageSize: options.pageSize },
      { defaultPageSize: config.pageSize, maxPageSize: config.maxPageSize },
    )

    log.debug('검색', {
      query: parsed.raw,
      matched: ids.length,
      filtered: filtered.length,
      filters: describeFilters(filters).join(', ') || undefined,
      page: page.page,
    })
    const result = present(page, { hooks, parsed, config, sort })
    if (options.facets) result.facets = facetCounts(filtered)

    const ms = Date.now() - started
    if (ms > SLOW_QUERY_MS) log.warn('느린 검색', { query: parsed.raw, ms, matched: ids.length })
    return result
  }

  return {
    search,
    use: (stage, fn) => hooks.use(stage, fn),
    suggest: (prefix, n) => suggestTerms(index, prefix, n),
    explain: (query, id) => explainScore(index, id, parseQuery(query), config),
    get: (id) => index.docs.get(id),
    stats: () => indexStats(index),
    config,
  }
}
