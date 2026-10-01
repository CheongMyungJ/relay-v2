import { ValidationError } from './errors.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 이메일을 소문자로 맞추고 형식을 확인한다
export function normalizeEmail(email) {
  const e = String(email ?? '').trim().toLowerCase()
  if (!EMAIL.test(e)) throw new ValidationError(`이메일 형식이 아님: ${email}`)
  return e
}
