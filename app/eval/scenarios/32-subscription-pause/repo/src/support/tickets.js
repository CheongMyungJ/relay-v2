import { getMember } from '../members/members.js'
import { RuleError } from '../util/errors.js'

// 고객 문의. 분류마다 답하는 팀이 다르다
const TEAMS = { billing: '결제팀', delivery: '배송팀', menu: '메뉴팀', other: 'CS팀' }
const tickets = []

export function openTicket({ memberId, category, text, today }) {
  getMember(memberId)
  if (!TEAMS[category]) throw new RuleError(`없는 문의 분류: ${category}`)
  if (!String(text ?? '').trim()) throw new RuleError('문의 내용이 비었음')
  const t = { id: `Q-${tickets.length + 1}`, memberId, category, team: TEAMS[category], text, openedOn: today, closedOn: null }
  tickets.push(t)
  return t
}

export function closeTicket(id, today) {
  const t = tickets.find((x) => x.id === id)
  if (!t) return null
  t.closedOn = today
  return t
}

export function openTickets(team) {
  return tickets.filter((t) => !t.closedOn && (!team || t.team === team))
}

export function clearTickets() {
  tickets.length = 0
}
