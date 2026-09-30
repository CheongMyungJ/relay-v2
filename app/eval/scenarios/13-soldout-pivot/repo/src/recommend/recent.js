// 최근 본 상품. 같은 상품을 다시 보면 맨 앞으로 온다.

export function createRecentlyViewed(limit = 10) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit는 1 이상의 정수여야 한다')
  const ids = []
  return {
    view(id) {
      const at = ids.indexOf(id)
      if (at >= 0) ids.splice(at, 1)
      ids.unshift(id)
      if (ids.length > limit) ids.length = limit
    },
    list: () => [...ids],
    clear() {
      ids.length = 0
    },
    has: (id) => ids.includes(id),
  }
}
