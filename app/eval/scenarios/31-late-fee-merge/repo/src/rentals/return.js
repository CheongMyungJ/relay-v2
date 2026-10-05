import { log } from '../log.js'
import { daysBetween } from '../util/dates.js'
import { RuleError } from '../util/errors.js'
import { getRental, saveRental } from './store.js'

/**
 * 반납 처리. 연체료가 있으면 charges에 더하고, 보증금에서 연체료를 뺀 나머지를 돌려준다.
 * @returns {{ rental: object, lateFee: number, refund: number }}
 */
export function processReturn(rentalId, returnedOn) {
  const rental = getRental(rentalId)
  if (rental.returnedOn) throw new RuleError(`이미 반납됨: ${rentalId}`)
  if (daysBetween(rental.startDate, returnedOn) < 0) throw new RuleError('반납일이 대여 시작일보다 앞섬')

  const overdue = daysBetween(rental.dueDate, returnedOn)
  let lateFee = 0
  if (overdue > 1) {
    lateFee = Math.round(rental.dailyRate * overdue * 0.5)
    lateFee = Math.min(lateFee, rental.deposit ?? Infinity)
  }

  rental.returnedOn = returnedOn
  if (lateFee > 0) rental.charges.push({ kind: 'late', amount: lateFee, on: returnedOn })
  const refund = rental.deposit == null ? 0 : rental.deposit - lateFee
  saveRental(rental)
  log.info('rental returned', { id: rentalId, overdue, lateFee })
  return { rental, lateFee, refund }
}
