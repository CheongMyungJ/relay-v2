// 알림 보내기. 지금은 모든 알림을 바로 보낸다(설정 없음)
import { getUser } from '../users/store.js'
import { emailFor } from './templates.js'

/** 보낸 메일 (시험과 개발용 우편함) */
export const outbox = []

/** 이벤트 하나를 받는 사람에게 알린다. 보냈으면 true */
export function notify(userId, event) {
  const user = getUser(userId)
  if (!user) return false
  outbox.push(emailFor(user, event))
  return true
}
