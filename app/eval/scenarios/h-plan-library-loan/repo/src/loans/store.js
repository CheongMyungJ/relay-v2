// 대출 기록 저장소 (메모리). 읽으면 복사본이 나오므로 바꾼 뒤에는 saveLoan으로 저장한다.
let loans = []
let seq = 0

export function resetLoans(list = []) {
  loans = list.map((l) => ({ ...l }))
  seq = loans.length
}

export function listLoans() {
  return loans.map((l) => ({ ...l }))
}

export function getLoan(id) {
  const l = loans.find((x) => x.id === id)
  return l ? { ...l } : null
}

export function saveLoan(loan) {
  const i = loans.findIndex((x) => x.id === loan.id)
  if (i < 0) loans.push({ ...loan })
  else loans[i] = { ...loan }
  return { ...loan }
}

/** 'L-0001' 꼴의 새 대출 번호 */
export function nextLoanId() {
  seq += 1
  return `L-${String(seq).padStart(4, '0')}`
}
