// 알림 보내기. 이벤트를 듣고 고객의 언어로 문구를 만들어 메일과 문자로 보낸다.
// 문자는 방해 금지 시간이면 미뤄 두었다가 flush()에서 보낸다. 받지 않기로 한 채널은 건너뛴다.
import { render } from './templates.js'
import { isQuiet, quietEnds } from './quiet-hours.js'

export function createNotifier({ store, bus, clock, customers, channels, preferences }) {
  bus.on('order.placed', ({ order }) =>
    notify(order.customerId, 'order.placed', {
      number: order.number,
      total: order.total,
      itemCount: order.lines.reduce((sum, l) => sum + l.qty, 0),
    }),
  )
  bus.on('order.shipped', ({ order }) =>
    notify(order.customerId, 'order.shipped', {
      number: order.number,
      carrier: order.shipment.carrier,
      trackingNo: order.shipment.trackingNo,
    }),
  )
  bus.on('order.cancelled', ({ order }) => notify(order.customerId, 'order.cancelled', { number: order.number }))
  bus.on('invoice.issued', ({ invoice }) => {
    // 카드 결제 주문의 송장은 결제 완료 메일로 갈음한다. 후불 송장만 보낸다
    if (invoice.orderId) return
    notify(invoice.customerId, 'invoice.issued', {
      invoiceNumber: invoice.number,
      total: invoice.total,
      dueAt: invoice.dueAt,
    })
  })
  bus.on('invoice.reminder', ({ reminder }) =>
    notify(reminder.customerId, 'invoice.reminder', {
      invoiceNumber: reminder.number,
      step: reminder.step,
      balance: reminder.balance,
    }),
  )

  /**
   * 고객 하나에게 알림을 보낸다.
   * @returns {{ channel: string, status: 'sent' | 'deferred' | 'skipped', reason?: string }[]}
   */
  function notify(customerId, type, data, { marketing = false } = {}) {
    const customer = customers.get(customerId)
    const msg = render(type, customer.locale, data)
    const now = clock.now()
    const results = []

    if (!customer.email) {
      results.push({ channel: 'email', status: 'skipped', reason: 'no-address' })
    } else if (!preferences.allows(customerId, 'email', { marketing })) {
      results.push({ channel: 'email', status: 'skipped', reason: 'opted-out' })
    } else {
      channels.email.send({ to: customer.email, subject: msg.subject, body: msg.body, type })
      results.push({ channel: 'email', status: 'sent' })
    }

    if (!customer.phone) {
      results.push({ channel: 'sms', status: 'skipped', reason: 'no-phone' })
    } else if (!preferences.allows(customerId, 'sms', { marketing })) {
      results.push({ channel: 'sms', status: 'skipped', reason: 'opted-out' })
    } else if (isQuiet(now)) {
      store.outbox.push({
        channel: 'sms',
        customerId,
        to: customer.phone,
        body: msg.sms,
        type,
        dueAt: quietEnds(now).toISOString(),
      })
      results.push({ channel: 'sms', status: 'deferred' })
    } else {
      channels.sms.send({ to: customer.phone, body: msg.sms, type })
      results.push({ channel: 'sms', status: 'sent' })
    }

    store.notifications.push({ customerId, type, at: now.toISOString(), results })
    return results
  }

  /** 광고. 광고 수신을 끈 고객은 건너뛴다 */
  function sendPromo(customerIds, { title, text }) {
    return customerIds.map((id) => ({ customerId: id, results: notify(id, 'promo', { title, text }, { marketing: true }) }))
  }

  /** 미뤄 둔 문자 가운데 때가 된 것을 보낸다 */
  function flush() {
    const now = clock.now()
    const due = store.outbox.filter((m) => new Date(m.dueAt) <= now)
    for (const m of due) {
      channels.sms.send({ to: m.to, body: m.body, type: m.type })
      store.outbox.splice(store.outbox.indexOf(m), 1)
    }
    return due.length
  }

  return {
    notify,
    sendPromo,
    flush,
    pending: () => store.outbox.map((m) => ({ ...m })),
    log: ({ customerId } = {}) =>
      store.notifications.filter((n) => !customerId || n.customerId === customerId).map((n) => structuredClone(n)),
  }
}
