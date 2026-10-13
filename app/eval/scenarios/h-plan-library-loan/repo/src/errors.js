/** 대출 창구에서 거절한 일. code로 까닭을 가른다 */
export class LoanError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.name = 'LoanError'
    this.code = code
  }
}
