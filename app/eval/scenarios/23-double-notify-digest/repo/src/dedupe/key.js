// 같은 알림인지 가리는 키.
import { createHash } from 'node:crypto'

// 키에 넣지 않는 필드: 추적용 값과 본문
const IGNORED_FIELDS = new Set(['traceId', 'deliveryAttempt', 'data'])

export function dedupeKey(event) {
  const parts = Object.keys(event)
    .filter((name) => !IGNORED_FIELDS.has(name) && event[name] !== undefined)
    .sort()
    .map((name) => `${name}=${event[name]}`)
  return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 24)
}
