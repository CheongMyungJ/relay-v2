// 푸시 어댑터. transport는 푸시 게이트웨이 클라이언트와 같은 모양이다:
//   push({ tokens, title, body, ttlSeconds, data }) → { id, results: [{ token, ok, error? }] }
// 게이트웨이 자체가 실패하면 status가 붙은 오류를 던진다.
import { truncate } from '../templates/filters.js'
import { SendError, SendTimeoutError } from './errors.js'

// 잠금 화면에서 잘리지 않는 길이
const MAX_TITLE = 40
const MAX_BODY = 120

export function createPushAdapter({ transport, ttlSeconds = 3600, onInvalidToken = () => {} }) {
  if (!transport?.push) throw new Error('푸시 transport가 없다')

  return {
    channel: 'push',
    async send(message) {
      if (!message.tokens?.length) throw new SendError('기기 토큰이 없다', { code: 'no-recipient' })
      let res
      try {
        res = await transport.push({
          tokens: message.tokens,
          title: truncate(message.title, MAX_TITLE),
          body: truncate(message.body, MAX_BODY),
          ttlSeconds: message.ttlSeconds ?? ttlSeconds,
          data: message.data ?? {},
        })
      } catch (err) {
        throw toSendError(err)
      }
      const results = res?.results ?? []
      for (const r of results) if (!r.ok && r.error === 'invalid-token') onInvalidToken(r.token)
      const delivered = results.filter((r) => r.ok).length
      if (delivered === 0) throw new SendError('모든 기기 토큰이 거절됐다', { code: 'invalid-token', transient: false })
      return { id: res.id, delivered, total: results.length }
    },
  }
}

function toSendError(err) {
  if (err instanceof SendError) return err
  if (err?.code === 'ETIMEDOUT') return new SendTimeoutError('푸시 게이트웨이 응답 없음', { cause: err })
  const status = Number(err?.status)
  if (status === 429 || status >= 500) return new SendError(err.message, { code: `push-${status}`, transient: true, cause: err })
  if (status >= 400) return new SendError(err.message, { code: `push-${status}`, transient: false, cause: err })
  return new SendError(err?.message ?? String(err), { code: 'unknown', transient: true, cause: err })
}
