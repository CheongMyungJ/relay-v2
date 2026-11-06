// 방해 금지 시간: 밤 9시부터 아침 8시까지(한국 시간)는 문자를 보내지 않고 아침 8시로 미룬다.
import { fromKst, kstParts } from '../shared/time.js'

export const QUIET = { start: 21, end: 8 }

export function isQuiet(date) {
  const { hour } = kstParts(date)
  return hour >= QUIET.start || hour < QUIET.end
}

/** 방해 금지 시간이 끝나는 때(다음 아침 8시, 한국 시간) */
export function quietEnds(date) {
  const p = kstParts(date)
  const today = fromKst(p.year, p.month, p.day, QUIET.end)
  return p.hour < QUIET.end ? today : new Date(today.getTime() + 24 * 60 * 60 * 1000)
}
