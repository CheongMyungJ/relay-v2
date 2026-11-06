// 업무 오류. code로 가른다(화면과 API가 code를 보고 문구를 고른다).

export class DomainError extends Error {
  constructor(code, message, details = {}) {
    super(message ?? code)
    this.name = 'DomainError'
    this.code = code
    this.details = details
  }
}

export function fail(code, message, details) {
  throw new DomainError(code, message, details)
}
