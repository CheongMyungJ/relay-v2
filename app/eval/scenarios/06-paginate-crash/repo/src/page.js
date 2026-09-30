// 목록을 쪽으로 나눈다. page는 1부터
export function paginate(items, page, size) {
  const start = page * size
  return items.slice(start, start + size)
}

// 전체 쪽 수
export function pageCount(total, size) {
  return Math.floor(total / size)
}
