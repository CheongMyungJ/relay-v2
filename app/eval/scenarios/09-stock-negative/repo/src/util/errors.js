export class StockError extends Error {
  constructor(message, code) {
    super(message)
    this.name = this.constructor.name
    this.code = code
  }
}

export class ValidationError extends StockError {
  constructor(message) {
    super(message, 'VALIDATION')
  }
}

export class NotFoundError extends StockError {
  constructor(message) {
    super(message, 'NOT_FOUND')
  }
}

export class InvalidStateError extends StockError {
  constructor(message) {
    super(message, 'INVALID_STATE')
  }
}

export class InsufficientStockError extends StockError {
  constructor(sku, requested, available) {
    super(`재고 부족: ${sku} 요청 ${requested}, 가용 ${available}`, 'INSUFFICIENT_STOCK')
    this.sku = sku
    this.requested = requested
    this.available = available
  }
}

export function assertPositiveInt(value, what) {
  if (!Number.isInteger(value) || value <= 0) throw new ValidationError(`${what}은 양의 정수여야 한다: ${value}`)
}
