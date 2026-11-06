// 도착 예정일. 평일 오후 2시(한국 시간) 전에 결제하면 그날 보낸다. 일요일과 공휴일에는 보내지도 받지도 않는다.
// 지역마다 걸리는 날: 서울·수도권 1일, 지방 2일, 제주 3일, 도서산간 4일.
import { fromKst, kstDate, kstParts } from '../shared/time.js'

export const TRANSIT_DAYS = { seoul: 1, metro: 1, local: 2, jeju: 3, island: 4 }
export const CUTOFF_HOUR = 14

// 운영팀이 해마다 넣는다
export const HOLIDAYS = new Set([
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-05', '2026-05-25',
  '2026-06-03', '2026-06-06', '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25',
])

function isWorkday(date) {
  const { weekday } = kstParts(date)
  return weekday !== 0 && !HOLIDAYS.has(kstDate(date))
}

function nextDay(date) {
  const p = kstParts(date)
  return fromKst(p.year, p.month, p.day + 1, 12)
}

/** 보내는 날(한국 날짜의 정오 시각) */
export function shipDate(paidAt) {
  const p = kstParts(paidAt)
  let day = fromKst(p.year, p.month, p.day, 12)
  if (!isWorkday(day) || p.hour >= CUTOFF_HOUR) day = nextDay(day)
  while (!isWorkday(day)) day = nextDay(day)
  return day
}

/** 도착 예정일 'YYYY-MM-DD' */
export function estimateDelivery(region, paidAt) {
  let day = shipDate(paidAt)
  let left = TRANSIT_DAYS[region] ?? TRANSIT_DAYS.local
  while (left > 0) {
    day = nextDay(day)
    if (isWorkday(day)) left -= 1
  }
  return kstDate(day)
}
