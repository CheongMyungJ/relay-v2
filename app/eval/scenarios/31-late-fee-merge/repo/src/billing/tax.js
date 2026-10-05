import { config } from '../config.js'

/** 공급가액의 부가세. 원 미만 버림 */
export function vatOf(supply) {
  return Math.floor(supply * config.vatRate)
}
