// 템플릿 필터: {{amount | won}}처럼 값 뒤에 붙여 쓴다.

export const filters = {
  upper: (v) => String(v).toUpperCase(),
  lower: (v) => String(v).toLowerCase(),
  trim: (v) => String(v).trim(),
  won: (v) => `${Math.round(Number(v)).toLocaleString('ko-KR')}원`,
  usd: (v) => `$${Number(v).toFixed(2)}`,
  date: (v) => formatDate(v),
  mask: (v) => maskEmail(String(v)),
  phone: (v) => formatPhone(String(v)),
  short: (v) => truncate(String(v), 40),
}

export function truncate(text, max) {
  const chars = [...text]
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`
}

function formatPhone(text) {
  const digits = text.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return text
}

function formatDate(v) {
  const d = new Date(typeof v === 'number' ? v : Date.parse(v))
  if (Number.isNaN(d.getTime())) return String(v)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`
}

function maskEmail(email) {
  const at = email.indexOf('@')
  if (at < 1) return email
  return `${email[0]}${'*'.repeat(Math.max(1, at - 1))}${email.slice(at)}`
}
