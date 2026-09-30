import { formatWon } from '../pricing/price.js'

const TEMPLATES = {
  'order.placed': (p) => ({
    subject: `[주문 접수] ${p.orderId}`,
    body: `${p.customerId}님의 주문이 접수되었습니다. 상품 ${p.items}종, 결제 금액 ${formatWon(p.total)}.`,
  }),
  'order.cancelled': (p) => ({
    subject: `[주문 취소] ${p.orderId}`,
    body: `${p.customerId}님의 주문이 취소되었습니다. 사유: ${p.reason || '없음'}.`,
  }),
  'order.shipped': (p) => ({
    subject: `[출고] ${p.orderId}`,
    body: `${p.customerId}님의 주문이 출고되었습니다. 출고 창고: ${p.warehouses.join(', ')}.`,
  }),
  'stock.low': (p) => ({
    subject: `[재고 부족] ${p.sku} ${p.warehouseName}`,
    body: `${p.sku}(${p.name})의 ${p.warehouseName} 창고 가용 재고가 ${p.available}개입니다.`,
  }),
}

export function render(event, payload) {
  const t = TEMPLATES[event]
  if (!t) throw new Error(`알림 템플릿이 없음: ${event}`)
  return t(payload)
}

export function knownEvents() {
  return Object.keys(TEMPLATES)
}

/**
 * 알림. 실제 발송 대신 outbox에 쌓고, flush가 채널 전송기(transport)에 넘긴다.
 * 수신자: 고객 알림은 customer, 운영 알림(stock.*)은 config.ops
 */
export function createNotifier({ config, clock, log, transports = {} }) {
  const outbox = []
  const sent = []
  let seq = 0

  function recipientFor(event, payload) {
    return event.startsWith('stock.') ? config.ops : payload.customerId
  }

  function send(event, payload) {
    const message = render(event, payload)
    for (const channel of config.channels) {
      outbox.push({
        id: ++seq,
        channel,
        event,
        to: recipientFor(event, payload),
        from: config.from,
        at: clock.iso(),
        ...message,
      })
    }
  }

  function flush() {
    let delivered = 0
    while (outbox.length) {
      const msg = outbox.shift()
      const transport = transports[msg.channel]
      try {
        if (transport) transport(msg)
        sent.push(msg)
        delivered++
      } catch (err) {
        log.error('알림 전송 실패', { id: msg.id, channel: msg.channel, error: err.message })
        msg.attempts = (msg.attempts ?? 0) + 1
        if (msg.attempts < 3) outbox.push(msg)
        break
      }
    }
    return delivered
  }

  return {
    send,
    flush,
    pending: () => outbox.map((m) => ({ ...m })),
    sent: () => sent.map((m) => ({ ...m })),
  }
}
