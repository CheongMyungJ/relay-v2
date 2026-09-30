// 쪽(page) 후처리 훅. 페이지를 나눈 뒤, 화면에 보낼 항목에 배지 같은 표시를 붙인다.
// 훅은 (items, ctx) => items 모양이다. 배열을 돌려주지 않으면 받은 것을 그대로 쓴다.

import { stockLabel } from '../catalog/stock.js'
import { discountRate } from '../util/money.js'

export const STAGES = ['page']

export function createHooks(initial = []) {
  const stages = Object.fromEntries(STAGES.map((s) => [s, []]))
  const hooks = {
    use(stage, fn) {
      if (!stages[stage]) throw new RangeError(`모르는 훅 단계: ${stage}`)
      if (typeof fn !== 'function') throw new TypeError('훅은 함수여야 한다')
      stages[stage].push(fn)
      return hooks
    },
    run(stage, items, ctx) {
      let out = items
      for (const fn of stages[stage] ?? []) {
        const next = fn(out, ctx)
        if (Array.isArray(next)) out = next
      }
      return out
    },
    list(stage) {
      return [...(stages[stage] ?? [])]
    },
  }
  for (const fn of initial) hooks.use('page', fn)
  return hooks
}

function addBadge(item, badge) {
  return { ...item, badges: [...item.badges, badge] }
}

// 재고 배지: '품절', '2개 남음'
export function stockBadge(items) {
  return items.map((item) => {
    const label = stockLabel(item.product)
    return label ? addBadge(item, label) : item
  })
}

// 할인 배지: '13% 할인'
export function discountBadge(items) {
  return items.map((item) => {
    const rate = discountRate(item.product.price, item.product.listPrice)
    return rate > 0 ? addBadge(item, `${rate}% 할인`) : item
  })
}

// 쪽 안에서 몇 번째인지(클릭 로그용)
export function positionHook(items, ctx) {
  const offset = (ctx.page - 1) * ctx.pageSize
  return items.map((item, i) => ({ ...item, position: offset + i + 1 }))
}

export const BUILTIN_HOOKS = [stockBadge, discountBadge, positionHook]
