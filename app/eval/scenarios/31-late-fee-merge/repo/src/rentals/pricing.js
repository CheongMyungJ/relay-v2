import { rentalDiscount } from '../members/grade.js'

/** 대여료: 일 대여료 × 날 수에서 등급 할인 */
export function rentalFee(dailyRate, days, grade) {
  const discount = rentalDiscount(grade)
  return Math.round(dailyRate * days * (1 - discount))
}
