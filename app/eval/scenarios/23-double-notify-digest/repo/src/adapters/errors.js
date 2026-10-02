// 발송 오류. transient면 다시 보내 볼 만하고, 아니면 다시 보내도 소용없다.

export class SendError extends Error {
  constructor(message, { code = 'unknown', transient = false, cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'SendError'
    this.code = code
    this.transient = transient
  }
}

export class SendTimeoutError extends SendError {
  constructor(message = '발송 시간 초과', { cause } = {}) {
    super(message, { code: 'timeout', transient: true, cause })
    this.name = 'SendTimeoutError'
  }
}

/** 모르는 오류는 네트워크 문제일 가능성이 커서 다시 보내 볼 만한 것으로 본다 */
export function isTransient(error) {
  if (error instanceof SendError) return error.transient
  return true
}

export function errorCode(error) {
  return error instanceof SendError ? error.code : (error?.code ?? 'unknown')
}
