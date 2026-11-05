// 로컬 개발과 시험에서 쓰는 가짜 전송. 실제로 보내지 않고 기록만 한다.
// 걸리는 시간은 clock.sleep으로 흉내 낸다(가상 시계면 실제로 기다리지 않는다).
//
// outcomes: 호출마다 앞에서 하나씩 꺼내 쓰는 결과. 비어 있으면 기본 지연으로 성공한다.
//   {}                                 성공
//   { latencyMs: 3000 }                3초 걸려 성공
//   { fail: 'transient' | 'permanent' | 'timeout', latencyMs? }
//   푸시만: { fail: 'invalid-token' }

export function createFakeMailTransport({ clock, latencyMs = 400, outcomes = [] } = {}) {
  if (!clock) throw new Error('clock이 필요하다')
  const script = [...outcomes]
  const calls = []
  const sent = []
  let seq = 0

  return {
    calls,
    sent,
    script: (...more) => script.push(...more),
    async deliver(mail) {
      const outcome = script.shift() ?? {}
      calls.push({ to: mail.to, subject: mail.subject, at: clock.now() })
      await clock.sleep(outcome.latencyMs ?? latencyMs)
      if (outcome.fail === 'timeout') throw Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' })
      if (outcome.fail === 'transient')
        throw Object.assign(new Error('421 4.3.2 Service not available'), { responseCode: 421 })
      if (outcome.fail === 'permanent')
        throw Object.assign(new Error('550 5.1.1 Mailbox unavailable'), { responseCode: 550 })
      const messageId = `<fake-${++seq}@mail.notify.test>`
      sent.push({ ...mail, messageId, at: clock.now() })
      return { messageId, accepted: [mail.to] }
    },
  }
}

export function createFakePushTransport({ clock, latencyMs = 80, outcomes = [] } = {}) {
  if (!clock) throw new Error('clock이 필요하다')
  const script = [...outcomes]
  const calls = []
  const sent = []
  let seq = 0

  return {
    calls,
    sent,
    script: (...more) => script.push(...more),
    async push(notification) {
      const outcome = script.shift() ?? {}
      calls.push({ tokens: [...notification.tokens], title: notification.title, at: clock.now() })
      await clock.sleep(outcome.latencyMs ?? latencyMs)
      if (outcome.fail === 'timeout') throw Object.assign(new Error('gateway timeout'), { code: 'ETIMEDOUT' })
      if (outcome.fail === 'transient') throw Object.assign(new Error('503 unavailable'), { status: 503 })
      if (outcome.fail === 'permanent') throw Object.assign(new Error('400 bad request'), { status: 400 })
      const id = `push-${++seq}`
      if (outcome.fail === 'invalid-token')
        return { id, results: notification.tokens.map((token) => ({ token, ok: false, error: 'invalid-token' })) }
      sent.push({ ...notification, id, at: clock.now() })
      return { id, results: notification.tokens.map((token) => ({ token, ok: true })) }
    },
  }
}
