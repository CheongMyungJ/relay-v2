export class NotFoundError extends Error {
  constructor(what, id) {
    super(`${what}을(를) 찾지 못함: ${id}`)
    this.name = 'NotFoundError'
  }
}

/** 업무 규칙에 맞지 않는 요청 */
export class RuleError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'RuleError'
  }
}
