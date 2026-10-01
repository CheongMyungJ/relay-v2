// 시험의 시계: tick()으로 1분씩 간다. 같은 시각에 여러 작업을 할 수도 있다
export function clock(start = '2026-10-01T09:00:00Z') {
  let t = new Date(start).getTime()
  return {
    now: () => new Date(t),
    tick: (minutes = 1) => {
      t += minutes * 60_000
    },
    at: () => new Date(t).toISOString(),
  }
}
