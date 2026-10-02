/** 휴대전화 번호의 가운데 네 자리를 가린다: 010-1234-5678 → 010-****-5678 */
export function maskPhone(phone) {
  return String(phone).replace(/^(\d{3})-(\d{3,4})-(\d{4})$/, (_, a, b, c) => `${a}-${'*'.repeat(b.length)}-${c}`)
}
