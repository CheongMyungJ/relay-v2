// 요약으로 받을 알림을 날짜(기간)와 사용자별로 모아 둔다.
// 기간은 알림을 받은 날(현지 날짜, 'YYYY-MM-DD')이고, 그 기간의 요약은 다음 날 아침에 나간다.

const DAY_MS = 24 * 60 * 60 * 1000

/** ms 시각이 속한 현지 날짜 */
export function periodOf(ms, tzOffsetMinutes) {
  return new Date(ms + tzOffsetMinutes * 60_000).toISOString().slice(0, 10)
}

/** 기간의 바로 전 날짜 */
export function previousPeriod(period) {
  return new Date(Date.parse(`${period}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10)
}

export function createDigestInbox({ tzOffsetMinutes }) {
  // period → Map(userId → Map(itemKey → item))
  const periods = new Map()

  return {
    /** 수신한 이벤트를 넣는다. 같은 이벤트가 이미 있으면 넣지 않고 false */
    add(event) {
      const period = periodOf(event.receivedAt, tzOffsetMinutes)
      if (!periods.has(period)) periods.set(period, new Map())
      const users = periods.get(period)
      if (!users.has(event.userId)) users.set(event.userId, new Map())
      const items = users.get(event.userId)
      const key = `${event.source}/${event.id}`
      if (items.has(key)) return false
      items.set(key, {
        eventId: event.id,
        source: event.source,
        type: event.type,
        userId: event.userId,
        occurredAt: event.occurredAt,
        data: { ...event.data },
      })
      return true
    },
    /** 기간에 모인 알림이 있는 사용자. 차례를 일정하게 하려고 정렬한다 */
    users(period) {
      return [...(periods.get(period)?.keys() ?? [])].sort()
    },
    /** 사용자 한 명의 기간 알림, 일어난 차례대로 */
    itemsFor(period, userId) {
      const items = periods.get(period)?.get(userId)
      return items ? [...items.values()].sort((a, b) => a.occurredAt - b.occurredAt) : []
    },
    periods: () => [...periods.keys()].sort(),
    /** 이 기간보다 오래된 것을 지운다 */
    dropBefore(period) {
      let dropped = 0
      for (const p of [...periods.keys()]) {
        if (p < period) {
          periods.delete(p)
          dropped++
        }
      }
      return dropped
    },
    size() {
      let n = 0
      for (const users of periods.values()) for (const items of users.values()) n += items.size
      return n
    },
  }
}
