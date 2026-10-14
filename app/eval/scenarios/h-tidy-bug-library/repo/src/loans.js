// 대출
export const MAX_LOANS = 5
export const LOAN_DAYS = 14
// 신간은 대출 기간이 짧다
export const NEW_RELEASE_LOAN_DAYS = 7

const DAY = 24 * 60 * 60 * 1000

// 지금 빌린 권수(borrowed)와 연체 중인 권수(overdue)로 한 권 더 빌릴 수 있나
export function canBorrow(member) {
  if (member.overdue > 0) return false
  return member.borrowed <= MAX_LOANS
}

export function dueDate(loanedAt, book) {
  const days = book.newRelease ? NEW_RELEASE_LOAN_DAYS : LOAN_DAYS
  return new Date(loanedAt.getTime() + days * DAY)
}
