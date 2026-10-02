// 이벤트 하나를 어느 채널로 누구에게 보낼지 정한다.
import { isQuietAt } from '../preferences/quiet-hours.js'

/**
 * @returns {{ deliveries: Array<{ channel, to?, tokens?, locale }>, skipped: Array<{ channel, reason }> }}
 */
export function planDeliveries(event, { templates, preferences, config, clock }) {
  const deliveries = []
  const skipped = []
  if (!templates.has(event.type)) return { deliveries, skipped: [{ channel: '*', reason: 'no-template' }] }

  const prefs = preferences.get(event.userId)
  const required = templates.isRequired(event.type)

  for (const channel of templates.channelsFor(event.type)) {
    if (!config.channels[channel]?.enabled) {
      skipped.push({ channel, reason: 'channel-disabled' })
      continue
    }
    if (!required && prefs.optOut.includes(channel)) {
      skipped.push({ channel, reason: 'opted-out' })
      continue
    }
    if (channel === 'mail') {
      if (!prefs.email) skipped.push({ channel, reason: 'no-email' })
      else deliveries.push({ channel, to: prefs.email, locale: prefs.locale })
    } else if (channel === 'push') {
      if (!prefs.pushTokens.length) skipped.push({ channel, reason: 'no-device' })
      else if (!required && isQuietAt(clock.now(), prefs.quietHours, prefs.tzOffsetMinutes))
        skipped.push({ channel, reason: 'quiet-hours' })
      else deliveries.push({ channel, tokens: [...prefs.pushTokens], locale: prefs.locale })
    } else {
      skipped.push({ channel, reason: 'unknown-channel' })
    }
  }
  return { deliveries, skipped }
}
