import { config } from '../config.js'
import { getMember } from '../members/members.js'
import { addDays, daysBetween } from '../util/dates.js'
import { RuleError } from '../util/errors.js'
import { rentalFee } from './pricing.js'
import { getRental, saveRental } from './store.js'

/**
 * 대여 연장. 이미 늦었으면 지금까지의 연체료를 먼저 받고, 오늘부터 extraDays를 더 빌려준다.
 */
export function extendRental(rentalId, today, extraDays) {
  const r = getRental(rentalId)
  if (r.returnedOn) throw new RuleError('반납된 대여는 연장할 수 없음')
  if (r.extensions >= config.maxExtensions) throw new RuleError(`연장은 ${config.maxExtensions}번까지`)
  if (!Number.isInteger(extraDays) || extraDays < 1) throw new RuleError('연장 기간은 1일 이상')

  const late = daysBetween(r.dueDate, today)
  const fee = late > 1 ? Math.min(Math.round(r.dailyRate * late * 0.5), r.deposit) : 0
  if (fee > 0) r.charges.push({ kind: 'late', amount: fee, on: today })

  const member = getMember(r.memberId)
  const rent = rentalFee(r.dailyRate, extraDays, member.grade)
  r.charges.push({ kind: 'rent', amount: rent, on: today })
  r.dueDate = addDays(late > 0 ? today : r.dueDate, extraDays)
  r.extensions += 1
  saveRental(r)
  return { rental: r, lateFee: fee, rentalFee: rent }
}
