import { getTool } from '../catalog/tools.js'
import { config } from '../config.js'
import { log } from '../log.js'
import { getMember } from '../members/members.js'
import { addDays } from '../util/dates.js'
import { RuleError } from '../util/errors.js'
import { rentalFee } from './pricing.js'
import { listRentals, nextRentalId, saveRental } from './store.js'

export function isAvailable(toolId) {
  return !listRentals().some((r) => r.toolId === toolId && !r.returnedOn)
}

/** 대여를 시작한다. 대여료를 받고 보증금을 맡는다 */
export function startRental({ memberId, toolId, startDate, days }) {
  if (!Number.isInteger(days) || days < 1) throw new RuleError('대여 기간은 1일 이상')
  if (days > config.maxRentalDays) throw new RuleError(`대여 기간은 ${config.maxRentalDays}일까지`)
  const member = getMember(memberId)
  const tool = getTool(toolId)
  if (!isAvailable(toolId)) throw new RuleError(`대여 중인 공구: ${tool.name}`)
  const rental = {
    id: nextRentalId(),
    memberId,
    toolId,
    toolName: tool.name,
    dailyRate: tool.dailyRate,
    deposit: tool.deposit,
    startDate,
    dueDate: addDays(startDate, days),
    returnedOn: null,
    extensions: 0,
    charges: [{ kind: 'rent', amount: rentalFee(tool.dailyRate, days, member.grade), on: startDate }],
  }
  saveRental(rental)
  log.info('rental started', { id: rental.id, toolId, memberId })
  return rental
}
