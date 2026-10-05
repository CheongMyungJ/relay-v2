import { getMember } from '../members/members.js'
import { listRentals } from '../rentals/store.js'
import { addDays, daysBetween } from '../util/dates.js'
import { formatWon } from '../util/money.js'
import { sendSms } from './sms.js'
import { render } from './templates.js'

/** 연체 안내 문자 글. 아직 늦지 않았으면 null */
export function reminderText(rental, today) {
  const days = daysBetween(rental.dueDate, today)
  if (days < 1) return null
  const fee = Math.min(Math.round(rental.dailyRate * days * 0.5), rental.deposit)
  const member = getMember(rental.memberId)
  return render('overdue', { name: member.name, tool: rental.toolName, days, fee: formatWon(fee) })
}

/** 매일 아침 보내는 문자: 내일 반납할 대여와 늦은 대여. 보낸 수 */
export function sendReminders(today) {
  let sent = 0
  for (const r of listRentals()) {
    if (r.returnedOn) continue
    const member = getMember(r.memberId)
    if (r.dueDate === addDays(today, 1)) {
      sendSms(member.phone, render('due-soon', { name: member.name, tool: r.toolName, due: r.dueDate }))
      sent++
      continue
    }
    const text = reminderText(r, today)
    if (text) {
      sendSms(member.phone, text)
      sent++
    }
  }
  return sent
}
