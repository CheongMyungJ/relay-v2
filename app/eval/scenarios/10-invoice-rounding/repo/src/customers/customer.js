// 고객(거래처)

export const GRADES = ['A', 'B', 'C']

// 사업자등록번호 검증. 숫자 10자리, 마지막 자리는 검증 숫자
const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5]

export function normalizeBizNo(text) {
  return String(text ?? '').replace(/[^0-9]/g, '')
}

export function isValidBizNo(text) {
  const digits = normalizeBizNo(text)
  if (digits.length !== 10) return false
  const d = [...digits].map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += d[i] * WEIGHTS[i]
  sum += Math.floor((d[8] * 5) / 10)
  return (10 - (sum % 10)) % 10 === d[9]
}

// '1208147521' -> '120-81-47521'
export function formatBizNo(text) {
  const d = normalizeBizNo(text)
  if (d.length !== 10) return String(text)
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// data: { id, name, bizNo, email?, grade?, zeroRated? }
// zeroRated: 수출 거래처처럼 영세율로 청구하는 고객
export function createCustomer(data) {
  const id = String(data.id ?? '').trim()
  if (!id) throw new Error('고객 ID가 없다')
  const name = String(data.name ?? '').trim()
  if (!name) throw new Error('고객 이름이 없다')
  const bizNo = normalizeBizNo(data.bizNo)
  if (!isValidBizNo(bizNo)) throw new Error(`사업자등록번호가 올바르지 않다: ${data.bizNo}`)
  const grade = data.grade ?? 'B'
  if (!GRADES.includes(grade)) throw new Error(`고객 등급은 ${GRADES.join(', ')} 중 하나: ${grade}`)
  const email = data.email ? String(data.email).trim().toLowerCase() : null
  if (email && !EMAIL_RE.test(email)) throw new Error(`이메일 형식이 아니다: ${data.email}`)
  return { id, name, bizNo, email, grade, zeroRated: Boolean(data.zeroRated) }
}
