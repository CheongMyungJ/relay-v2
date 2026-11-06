// 보내는 길(가짜). 실제로는 메일 서버와 문자 대행사로 간다. 보낸 것을 sent에 남긴다.
import { isEmail, normalizePhone } from '../customers/customers.js'

export const SMS_MAX = 90

export function createEmailChannel(clock) {
  const sent = []
  return {
    name: 'email',
    sent,
    send({ to, subject, body, type }) {
      if (!isEmail(to)) throw new Error(`메일 주소: ${to}`)
      sent.push({ to, subject, body, type, at: clock.now().toISOString() })
      return { ok: true }
    },
  }
}

export function createSmsChannel(clock) {
  const sent = []
  return {
    name: 'sms',
    sent,
    send({ to, body, type }) {
      const phone = normalizePhone(to)
      if (!phone) throw new Error(`전화번호: ${to}`)
      // 긴 문자는 장문(LMS)으로 간다. 대행사 요금이 다르다
      const kind = body.length > SMS_MAX ? 'lms' : 'sms'
      sent.push({ to: phone, body, type, kind, at: clock.now().toISOString() })
      return { ok: true, kind }
    },
  }
}
