// 채널별 메시지 만들기.

export function buildMessage(event, delivery, { templates, config }) {
  const vars = { ...event.data, userId: event.userId }
  const text = templates.renderFor(event.type, delivery.channel, delivery.locale, vars)

  if (delivery.channel === 'mail') {
    return {
      from: config.channels.mail.from,
      to: delivery.to,
      subject: text.subject,
      body: text.body,
      headers: {
        'X-Notify-Event': `${event.source}/${event.id}`,
        ...(event.traceId ? { 'X-Trace-Id': event.traceId } : {}),
      },
    }
  }
  if (delivery.channel === 'push') {
    return {
      tokens: delivery.tokens,
      title: text.title,
      body: text.body,
      ttlSeconds: config.channels.push.ttlSeconds,
      data: { eventId: event.id, type: event.type },
    }
  }
  throw new Error(`모르는 채널: ${delivery.channel}`)
}
