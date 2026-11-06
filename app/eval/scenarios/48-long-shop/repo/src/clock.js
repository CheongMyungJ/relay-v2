// 시계. 서비스는 이 시계로만 지금을 읽는다. 시험은 set/advance로 시간을 옮긴다.

export function createClock(start = '2026-03-02T01:00:00Z') {
  let t = Date.parse(start)
  if (Number.isNaN(t)) throw new Error(`잘못된 시각: ${start}`)
  return {
    now: () => new Date(t),
    advance(ms) {
      t += ms
    },
    set(iso) {
      const next = Date.parse(iso)
      if (Number.isNaN(next)) throw new Error(`잘못된 시각: ${iso}`)
      t = next
    },
  }
}
