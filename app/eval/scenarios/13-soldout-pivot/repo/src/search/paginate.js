// 페이지 나누기. 정렬된 전체 목록에서 한 쪽을 잘라 낸다.

import { clamp, toPositiveInt } from '../util/number.js'

export function paginate(list, { page, pageSize } = {}, { defaultPageSize = 20, maxPageSize = 100 } = {}) {
  const size = clamp(toPositiveInt(pageSize, defaultPageSize), 1, maxPageSize)
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const current = toPositiveInt(page, 1)
  const start = (current - 1) * size
  return {
    items: list.slice(start, start + size),
    page: current,
    pageSize: size,
    total,
    totalPages,
    hasPrev: current > 1,
    hasNext: current < totalPages,
  }
}

// 화면 아래 쪽 번호: 현재 쪽 둘레로 width개
export function pageNumbers({ page, totalPages }, width = 5) {
  const half = Math.floor(width / 2)
  let first = clamp(page - half, 1, Math.max(1, totalPages - width + 1))
  const last = Math.min(totalPages, first + width - 1)
  first = Math.max(1, Math.min(first, last - width + 1))
  const out = []
  for (let n = first; n <= last; n++) out.push(n)
  return out
}
