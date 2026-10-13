import { DELAY_NOTICE_MIN } from '../config.js'

/** 지연 문자를 만든다. 지연이 기준 분보다 짧으면 보내지 않는다(null) */
export function sendDelayNotice(order, delayMin) {
  if (delayMin < DELAY_NOTICE_MIN) return null
  return { to: order.phone, text: `배달이 약 ${delayMin}분 늦어지고 있습니다.` }
}
