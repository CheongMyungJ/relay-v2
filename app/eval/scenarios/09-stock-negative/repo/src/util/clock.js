const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 시계. fixed를 주면 그 시각에 멈춰 있고 advance로만 움직인다.
 */
export function createClock(fixed) {
  let current = fixed === undefined ? null : new Date(fixed).getTime()
  if (current !== null && Number.isNaN(current)) throw new Error(`시각이 잘못됨: ${fixed}`)
  return {
    now() {
      return new Date(current ?? Date.now())
    },
    ms() {
      return current ?? Date.now()
    },
    iso() {
      return this.now().toISOString()
    },
    advance(ms) {
      if (current === null) throw new Error('실제 시계는 움직일 수 없다')
      current += ms
    },
  }
}

/** 한국 시간 기준 날짜 문자열(YYYY-MM-DD) */
export function kstDate(date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** date가 속한 주(월요일~일요일, 한국 시간)의 시작과 끝 */
export function kstWeek(date) {
  const local = new Date(date.getTime() + KST_OFFSET_MS)
  const dow = (local.getUTCDay() + 6) % 7 // 월=0
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - dow * DAY_MS
  const start = new Date(startLocal - KST_OFFSET_MS)
  const end = new Date(start.getTime() + 7 * DAY_MS)
  return { start, end, label: `${kstDate(start)} ~ ${kstDate(new Date(end.getTime() - 1))}` }
}

export function inRange(date, { start, end }) {
  const t = new Date(date).getTime()
  return t >= start.getTime() && t < end.getTime()
}
