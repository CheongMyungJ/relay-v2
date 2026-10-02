// 사람이 읽기 쉬운 id 만들기

const counters = new Map()

/** prefix마다 1부터 늘어나는 id: job-1, job-2, ... */
export function nextId(prefix) {
  const n = (counters.get(prefix) ?? 0) + 1
  counters.set(prefix, n)
  return `${prefix}-${n}`
}

/** 시험에서 번호를 처음부터 다시 매길 때 */
export function resetIds() {
  counters.clear()
}

/** 날짜가 들어간 배치 id: batch-20260930-0215 */
export function batchId(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `batch-${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}`
}

/** 'job-12' → 12. 번호가 없으면 null */
export function idNumber(id) {
  const m = /-(\d+)$/.exec(String(id))
  return m ? Number(m[1]) : null
}

/** 시각(ms)을 36진수로 줄인 짧은 꼬리표: 1759197304120 → 'mg5wnj94'. 이름 뒤에 붙여 겹치지 않게 할 때 쓴다 */
export function stamp(ms = Date.now()) {
  return Math.floor(ms).toString(36)
}
