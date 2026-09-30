// 한 쪽을 화면에 보낼 모양으로 만든다. 쪽 훅을 돌리고 표시용 필드를 채운다.

import { isSoldOut } from '../catalog/stock.js'
import { formatKRW } from '../util/money.js'
import { highlight } from './highlight.js'

function toView(item, parsed, config) {
  const p = item.product
  return {
    id: item.id,
    name: p.name,
    nameHtml: highlight(p.name, parsed.terms, { ...config.highlight, synonyms: config.synonyms }),
    brand: p.brand,
    category: p.category,
    price: p.price,
    priceText: formatKRW(p.price),
    soldOut: isSoldOut(p),
    score: item.score,
    position: item.position,
    badges: item.badges,
  }
}

export function present(pageResult, { hooks, parsed, config, sort }) {
  const start = pageResult.items.map((hit) => ({ id: hit.id, product: hit.product, score: hit.score, badges: [] }))
  const ctx = { query: parsed, sort, page: pageResult.page, pageSize: pageResult.pageSize }
  const items = hooks.run('page', start, ctx)
  return {
    query: parsed.raw,
    sort,
    page: pageResult.page,
    pageSize: pageResult.pageSize,
    total: pageResult.total,
    totalPages: pageResult.totalPages,
    hasPrev: pageResult.hasPrev,
    hasNext: pageResult.hasNext,
    items: items.map((item) => toView(item, parsed, config)),
  }
}
