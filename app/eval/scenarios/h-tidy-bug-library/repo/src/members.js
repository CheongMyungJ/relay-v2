// 회원증 번호: <지점 코드 2자리>-<6자리 일련번호>
export function cardNumber(branch, seq) {
  return `${branch}-${String(seq).padStart(6, '0')}`
}
