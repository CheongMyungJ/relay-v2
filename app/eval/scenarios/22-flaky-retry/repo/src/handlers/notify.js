// notify 작업: 받는 사람에게 알림을 보낸다. 메일 발송기는 바깥에서 넣는다.
import { RetryableError } from '../runner/retry.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 보낸 메일을 모아 두는 가짜 발송기. failTimes만큼 일시 오류를 낸다 */
export function createOutbox({ failTimes = 0 } = {}) {
  const sent = []
  let failures = 0
  return {
    sent,
    async send(message) {
      if (failures < failTimes) {
        failures++
        throw new RetryableError('메일 서버가 잠시 응답하지 않습니다')
      }
      sent.push(message)
      return { messageId: `msg-${sent.length}` }
    },
  }
}

/**
 * @param {{ mailer: { send: (m: object) => Promise<{ messageId: string }> } }} deps
 */
export function createNotifyHandler({ mailer }) {
  return async function notify(payload) {
    const to = [].concat(payload.to ?? [])
    if (!to.length) throw new Error('notify 작업에는 받는 사람(to)이 필요합니다')
    const bad = to.filter((addr) => !EMAIL.test(addr))
    if (bad.length) throw new Error(`메일 주소가 틀렸습니다: ${bad.join(', ')}`)
    const subject = payload.subject ?? '(제목 없음)'
    const { messageId } = await mailer.send({ to, subject, body: payload.body ?? '' })
    return { messageId, to: to.length }
  }
}
