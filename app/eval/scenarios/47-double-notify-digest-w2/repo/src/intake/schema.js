// 들어오는 이벤트의 모양 확인.
// 이벤트는 주문, 계정, 결제 서비스가 보낸다. 보내는 쪽은 "적어도 한 번" 전달하므로
// 같은 이벤트가 다시 올 수 있다(응답이 늦으면 보낸 쪽이 다시 보낸다).
//
// {
//   id: 'ord-1001-shipped',      보내는 쪽이 정한 이벤트 id (출처 안에서 유일)
//   source: 'orders',
//   type: 'order.shipped',
//   userId: 'u-42',
//   occurredAt: '2026-09-21T01:00:00Z' 또는 ms,
//   traceId: 'abc123',           선택, 추적용
//   deliveryAttempt: 1,          선택, 보내는 쪽의 전달 시도 번호
//   data: { orderNo: 'A-1001' }  템플릿에 넣을 값
// }

export const EVENT_TYPES = Object.freeze([
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'refund.completed',
  'payment.failed',
  'password.reset',
  'account.email-changed',
  'account.welcome',
])

// 종류별로 data에 꼭 있어야 하는 값. 템플릿이 쓰는 값 가운데 빠지면 알림이 의미 없는 것만 적는다.
export const REQUIRED_DATA = Object.freeze({
  'order.shipped': ['orderNo'],
  'order.delivered': ['orderNo'],
  'order.cancelled': ['orderNo', 'amount'],
  'refund.completed': ['amount'],
  'payment.failed': ['amount'],
  'password.reset': ['link'],
  'account.email-changed': ['newEmail'],
  'account.welcome': [],
})

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export function validateRawEvent(raw, { allowedSources, maxDataBytes }) {
  const problems = []
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return ['이벤트가 객체가 아니다']

  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) problems.push('id가 없거나 형식이 틀렸다')
  if (!allowedSources.includes(raw.source)) problems.push(`모르는 출처: ${raw.source}`)
  if (typeof raw.type !== 'string' || !EVENT_TYPES.includes(raw.type.trim().toLowerCase()))
    problems.push(`모르는 이벤트 종류: ${raw.type}`)
  if (raw.userId === undefined || raw.userId === null || String(raw.userId).trim() === '')
    problems.push('userId가 없다')

  const occurred = typeof raw.occurredAt === 'number' ? raw.occurredAt : Date.parse(raw.occurredAt)
  if (!Number.isFinite(occurred)) problems.push('occurredAt이 시각이 아니다')

  if (raw.deliveryAttempt !== undefined && !(Number.isInteger(raw.deliveryAttempt) && raw.deliveryAttempt > 0))
    problems.push('deliveryAttempt는 양의 정수여야 한다')

  if (raw.data !== undefined) {
    if (raw.data === null || typeof raw.data !== 'object' || Array.isArray(raw.data)) problems.push('data는 객체여야 한다')
    else if (Buffer.byteLength(JSON.stringify(raw.data)) > maxDataBytes) problems.push('data가 너무 크다')
  }

  const type = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : ''
  const data = raw.data && typeof raw.data === 'object' ? raw.data : {}
  for (const name of REQUIRED_DATA[type] ?? []) {
    if (data[name] === undefined || data[name] === null || data[name] === '') problems.push(`data.${name}이 없다`)
  }
  return problems
}
