// 연체료 (책 한 권 기준)
export const DAILY_FINE = 100
export const FINE_CAP = 3000

export function lateFine(daysLate) {
  if (daysLate <= 0) return 0
  return Math.min(daysLate * DAILY_FINE, FINE_CAP)
}
