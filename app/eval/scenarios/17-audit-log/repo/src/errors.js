export class NotFoundError extends Error {
  constructor(what) {
    super(`${what} 없음`)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
  }
}
