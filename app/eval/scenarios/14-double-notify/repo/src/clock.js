// 시각과 대기. 운영에서는 시스템 시계를 쓰고, 시험과 로컬 재현에서는 가상 시계를 쓴다.
// 모든 모듈은 Date.now()를 직접 부르지 않고 주입받은 clock을 쓴다.

export function createSystemClock() {
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms))),
  }
}

/**
 * 가상 시계. sleep은 실제로 기다리지 않고 시각만 앞으로 민다.
 * @param {number|string} start 시작 시각(ms 또는 ISO 문자열)
 */
export function createVirtualClock(start = 0) {
  let current = typeof start === 'string' ? Date.parse(start) : start
  if (!Number.isFinite(current)) throw new TypeError(`잘못된 시작 시각: ${start}`)

  return {
    now: () => current,
    advance(ms) {
      if (!(ms >= 0)) throw new RangeError(`시각은 앞으로만 민다: ${ms}`)
      current += ms
      return current
    },
    set(ms) {
      if (ms < current) throw new RangeError('시각을 되돌릴 수 없다')
      current = ms
      return current
    },
    sleep(ms) {
      current += Math.max(0, ms)
      return Promise.resolve()
    },
  }
}

export function isoNow(clock) {
  return new Date(clock.now()).toISOString()
}
