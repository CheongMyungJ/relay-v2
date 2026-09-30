// 이벤트 수신: 모양을 확인하고 내부 모양으로 바꾼 뒤 수신 시각을 붙인다.
import { normalizeEvent } from './normalize.js'
import { validateRawEvent } from './schema.js'

export class IntakeError extends Error {
  constructor(problems) {
    super(`이벤트를 받을 수 없음: ${problems.join('; ')}`)
    this.name = 'IntakeError'
    this.problems = problems
  }
}

/**
 * @param {object} raw 보내는 쪽이 보낸 이벤트
 * @param {{ clock: { now(): number }, config: object }} ctx
 */
export function receive(raw, { clock, config }) {
  const problems = validateRawEvent(raw, config.intake)
  if (problems.length) throw new IntakeError(problems)

  const event = normalizeEvent(raw)
  event.receivedAt = clock.now()

  if (event.occurredAt - event.receivedAt > config.intake.maxClockSkewMs)
    throw new IntakeError([`occurredAt이 수신 시각보다 ${event.occurredAt - event.receivedAt}ms 미래다`])
  return event
}

/** 웹훅 본문(JSON 문자열)을 이벤트 배열로. 객체 하나나 배열 모두 받는다 */
export function parseBody(text) {
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new IntakeError(['본문이 JSON이 아니다'])
  }
  if (Array.isArray(body)) return body
  if (body && typeof body === 'object') return [body]
  throw new IntakeError(['본문이 객체나 배열이 아니다'])
}

/** 수신 지연(발생부터 수신까지). 지표용 */
export function intakeLagMs(event) {
  return Math.max(0, event.receivedAt - event.occurredAt)
}
