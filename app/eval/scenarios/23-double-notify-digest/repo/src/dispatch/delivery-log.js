// 발송 시도 기록. 운영에서는 DB에 쓰고, 여기서는 메모리에 둔다.
// 고객 문의가 오면 이 기록으로 언제 몇 번 보냈는지 확인한다.

export function createDeliveryLog({ clock, limit = 10_000 }) {
  const entries = []

  return {
    record(entry) {
      entries.push({ ...entry, at: clock.now() })
      if (entries.length > limit) entries.shift()
    },
    entries: () => entries.map((e) => ({ ...e })),
    forEvent: (eventId) => entries.filter((e) => e.eventId === eventId).map((e) => ({ ...e })),
    /** 채널별 마지막 상태 */
    latest(eventId) {
      const out = {}
      for (const e of entries) if (e.eventId === eventId) out[e.channel] = e.status
      return out
    },
    /** 조건에 맞는 기록. 문의 대응용 */
    search({ eventId, channel, status, since, until } = {}) {
      return entries
        .filter(
          (e) =>
            (eventId === undefined || e.eventId === eventId) &&
            (channel === undefined || e.channel === channel) &&
            (status === undefined || e.status === status) &&
            (since === undefined || e.at >= since) &&
            (until === undefined || e.at < until),
        )
        .map((e) => ({ ...e }))
    },
    /** 채널과 상태별 건수 */
    summary() {
      const out = {}
      for (const e of entries) {
        out[e.channel] ??= {}
        out[e.channel][e.status] = (out[e.channel][e.status] ?? 0) + 1
      }
      return out
    },
    size: () => entries.length,
  }
}
