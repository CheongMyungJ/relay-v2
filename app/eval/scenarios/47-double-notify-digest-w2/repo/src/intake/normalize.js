// 검사를 통과한 이벤트를 내부 모양으로 바꾼다.

export function normalizeEvent(raw) {
  const occurredAt = typeof raw.occurredAt === 'number' ? raw.occurredAt : Date.parse(raw.occurredAt)
  const event = {
    id: raw.id,
    source: raw.source,
    type: raw.type.trim().toLowerCase(),
    userId: String(raw.userId).trim(),
    occurredAt,
    data: { ...(raw.data ?? {}) },
  }
  if (raw.traceId) event.traceId = String(raw.traceId)
  if (raw.deliveryAttempt) event.deliveryAttempt = raw.deliveryAttempt
  return event
}

/** 로그에 남길 짧은 요약 */
export function describeEvent(event) {
  return `${event.source}/${event.type}#${event.id} → ${event.userId}`
}
