import { COMPANY } from '../config.js'
import { formatDateKo } from '../format/date.js'
import { formatWon } from '../format/won.js'
import { daysOverdue } from '../invoice/due.js'
import { invoiceTotals } from '../invoice/invoice.js'

// 연체 단계. 연체 일수가 min 이상이면 그 단계
export const REMINDER_STAGES = [
  { stage: 'first', min: 1, subject: '납부 기한이 지났습니다' },
  { stage: 'second', min: 15, subject: '[재안내] 미납 청구서가 있습니다' },
  { stage: 'final', min: 30, subject: '[최종 안내] 미납 청구서 납부 요청' },
]

export function reminderStage(days) {
  let found = null
  for (const s of REMINDER_STAGES) if (days >= s.min) found = s
  return found
}

// 고객별로 연체 청구서를 모아 안내 메일을 만든다. 이메일이 없는 고객은 건너뛴다
// customers: createCustomerStore()의 결과
export function buildReminders(invoices, customers, today) {
  const byCustomer = new Map()
  for (const inv of invoices) {
    const days = daysOverdue(inv, today)
    if (!days) continue
    const list = byCustomer.get(inv.customerId) ?? []
    list.push({ invoice: inv, days })
    byCustomer.set(inv.customerId, list)
  }

  const mails = []
  for (const [customerId, items] of byCustomer) {
    const customer = customers.get(customerId)
    if (!customer?.email) continue
    items.sort((a, b) => b.days - a.days)
    const stage = reminderStage(items[0].days)
    const amount = items.reduce((s, it) => s + invoiceTotals(it.invoice).total, 0)
    const lines = items.map(
      (it) =>
        `- ${it.invoice.number}: ${formatWon(invoiceTotals(it.invoice).total)} ` +
        `(납부 기한 ${formatDateKo(it.invoice.dueDate)}, ${it.days}일 지남)`,
    )
    mails.push({
      to: customer.email,
      customerId,
      stage: stage.stage,
      subject: `${stage.subject} - ${COMPANY.name}`,
      body: [
        `${customer.name} 담당자님께,`,
        '',
        `아래 청구서 ${items.length}건, 합계 ${formatWon(amount)}이 아직 입금되지 않았습니다.`,
        ...lines,
        '',
        `입금 계좌: ${COMPANY.bank}`,
        `문의: ${COMPANY.phone}`,
      ].join('\n'),
    })
  }
  return mails.sort((a, b) => a.customerId.localeCompare(b.customerId))
}
