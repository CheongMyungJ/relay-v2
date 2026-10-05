import { config } from '../config.js'

// 문자 발송. 실제로는 문자 업체 API를 부르지만 여기서는 보낸 함에 쌓는다
export const outbox = []

export function sendSms(phone, text) {
  if (!config.sms.enabled) return false
  outbox.push({ from: config.sms.sender, to: phone, text })
  return true
}

export function clearOutbox() {
  outbox.length = 0
}
