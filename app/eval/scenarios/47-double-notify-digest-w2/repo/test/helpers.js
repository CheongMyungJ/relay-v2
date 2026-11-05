// 시험 공용 도우미
import { createFakeMailTransport, createFakePushTransport } from '../src/adapters/fake-transports.js'
import { createVirtualClock } from '../src/clock.js'
import { createNotifier } from '../src/notifier.js'

// 서울 오전 10시
export const START = '2026-09-21T01:00:00Z'

export const USERS = {
  'u-1': { email: 'mina@example.com', pushTokens: ['tok-a'], locale: 'ko' },
  'u-2': { email: 'sam@example.com', pushTokens: ['tok-b', 'tok-c'], locale: 'en' },
  'u-3': { email: 'jun@example.com', pushTokens: [], locale: 'ko' },
}

export function shippedEvent(overrides = {}) {
  return {
    id: 'ord-1001-shipped',
    source: 'orders',
    type: 'order.shipped',
    userId: 'u-1',
    occurredAt: '2026-09-21T00:59:58Z',
    data: { orderNo: 'A-1001', carrier: 'CJ대한통운', trackingNo: '6400-1234' },
    ...overrides,
  }
}

export function setup({ mail = {}, push = {}, config, users = USERS } = {}) {
  const clock = createVirtualClock(START)
  const transports = {
    mail: createFakeMailTransport({ clock, ...mail }),
    push: createFakePushTransport({ clock, ...push }),
  }
  const notifier = createNotifier({ clock, transports, preferences: users, config })
  return { clock, notifier, ...transports }
}
