import { config } from '../config.js'
import { getMember, setGrade } from './members.js'

/** 대여료 할인율 */
export function rentalDiscount(grade) {
  return grade === 'plus' ? config.plusDiscount : 0
}

/** 반납을 마친 대여 수가 기준을 넘으면 plus로 올린다. 올렸으면 true */
export function maybePromote(memberId, finishedRentals) {
  const m = getMember(memberId)
  if (m.grade === 'plus') return false
  if (finishedRentals < config.plusAfterRentals) return false
  setGrade(memberId, 'plus')
  return true
}
