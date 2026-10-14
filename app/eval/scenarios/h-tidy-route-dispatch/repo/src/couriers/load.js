import { MAX_STOPS } from '../config.js'

/** 기사의 부하: 정거장 칸 수 / MAX_STOPS. 냉장 주문은 2칸으로 센다 */
export function loadFactor(courier) {
  const used = courier.stops.reduce((n, s) => n + (s.cold ? 2 : 1), 0)
  return used / MAX_STOPS
}
