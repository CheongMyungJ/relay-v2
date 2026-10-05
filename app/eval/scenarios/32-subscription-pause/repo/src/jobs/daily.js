import { runBilling } from '../billing/billing.js'
import { scheduleDeliveries } from '../deliveries/deliveries.js'
import { log } from '../log.js'
import { sendBillingReminders } from '../notify/reminders.js'

/** 매일 새벽에 도는 작업: 결제 → 배송 → 결제 안내 */
export function runDaily(today) {
  const charges = runBilling(today)
  const deliveries = scheduleDeliveries(today)
  const reminders = sendBillingReminders(today)
  log.info('daily', { today, charges: charges.length, deliveries: deliveries.length, reminders: reminders.length })
  return { charges, deliveries, reminders }
}
