import { CLOSED_WEEKDAY, HOLIDAYS } from './config.js'
import { addDays, weekday } from './util/dates.js'

export function isOpenDay(date) {
  return weekday(date) !== CLOSED_WEEKDAY && !HOLIDAYS.includes(date)
}

/** date가 개관일이면 date, 아니면 그 뒤 첫 개관일 */
export function nextOpenDay(date) {
  let d = date
  while (!isOpenDay(d)) d = addDays(d, 1)
  return d
}
