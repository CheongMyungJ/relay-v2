import { WINDOW_GRACE_MIN } from '../config.js'

/** 도착 분(자정부터)이 창을 지키는가: 일찍 닿는 것은 괜찮고, 끝 + 유예까지 */
export function fitsWindow(arriveMin, window) {
  return arriveMin <= window.endMin + WINDOW_GRACE_MIN
}
