import { getTool } from '../catalog/tools.js'
import { getMember } from '../members/members.js'
import { addDays, parseDate } from '../util/dates.js'
import { RuleError } from '../util/errors.js'

// 예약: 아직 대여가 시작되지 않은 약속. 대여가 시작되면 지운다
const reservations = []
let seq = 0

function overlaps(aFrom, aTo, bFrom, bTo) {
  return parseDate(aFrom) < parseDate(bTo) && parseDate(bFrom) < parseDate(aTo)
}

export function reserve({ memberId, toolId, from, days }) {
  getMember(memberId)
  getTool(toolId)
  if (!Number.isInteger(days) || days < 1) throw new RuleError('예약 기간은 1일 이상')
  const to = addDays(from, days)
  const clash = reservations.find((r) => r.toolId === toolId && overlaps(r.from, r.to, from, to))
  if (clash) throw new RuleError(`이미 예약됨: ${clash.from}~${clash.to}`)
  seq += 1
  const r = { id: `B-${seq}`, memberId, toolId, from, to }
  reservations.push(r)
  return r
}

export function cancelReservation(id) {
  const i = reservations.findIndex((r) => r.id === id)
  if (i < 0) return false
  reservations.splice(i, 1)
  return true
}

export function reservationsFor(toolId) {
  return reservations.filter((r) => r.toolId === toolId).sort((a, b) => a.from.localeCompare(b.from))
}

export function clearReservations() {
  reservations.length = 0
  seq = 0
}
