// 메일 어댑터. transport는 SMTP 중계 서버 클라이언트와 같은 모양이다:
//   deliver({ from, to, subject, text, headers }) → { messageId, accepted }
// 실패하면 responseCode(SMTP 응답 코드)나 code(ETIMEDOUT 같은 소켓 오류)가 붙은 오류를 던진다.
import { SendError, SendTimeoutError } from './errors.js'

const SOCKET_TIMEOUTS = new Set(['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNRESET'])

export function createMailAdapter({ transport, from }) {
  if (!transport?.deliver) throw new Error('메일 transport가 없다')

  return {
    channel: 'mail',
    async send(message) {
      if (!message.to) throw new SendError('받는 사람 메일 주소가 없다', { code: 'no-recipient' })
      let res
      try {
        res = await transport.deliver({
          from: message.from ?? from,
          to: message.to,
          subject: oneLine(message.subject),
          text: message.body,
          headers: message.headers ?? {},
        })
      } catch (err) {
        throw toSendError(err)
      }
      if (!res?.accepted?.includes(message.to))
        throw new SendError('중계 서버가 받는 사람을 거절했다', { code: 'rejected', transient: false })
      return { id: res.messageId }
    },
  }
}

// 제목에 줄바꿈이 들어가면 헤더가 깨진다
function oneLine(text) {
  return String(text ?? '').replace(/[\r\n]+/g, ' ').trim()
}

export function toSendError(err) {
  if (err instanceof SendError) return err
  if (SOCKET_TIMEOUTS.has(err?.code)) return new SendTimeoutError(`메일 서버 응답 없음 (${err.code})`, { cause: err })
  const code = Number(err?.responseCode)
  if (code >= 400 && code < 500) return new SendError(err.message, { code: `smtp-${code}`, transient: true, cause: err })
  if (code >= 500) return new SendError(err.message, { code: `smtp-${code}`, transient: false, cause: err })
  return new SendError(err?.message ?? String(err), { code: 'unknown', transient: true, cause: err })
}
