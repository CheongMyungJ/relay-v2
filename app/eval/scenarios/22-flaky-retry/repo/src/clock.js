// 시간 관련 함수. 기다리기(sleep)와 현재 시각(now)을 한곳에 두어 시험에서 바꿔 끼울 수 있게 한다.

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
const realNow = () => Date.now()

let sleepImpl = realSleep
let nowImpl = realNow

/** ms만큼 기다린다 */
export function sleep(ms) {
  return sleepImpl(ms)
}

/** 기다리기 함수를 바꾼다. fn(ms) => Promise */
export function setSleep(fn) {
  if (typeof fn !== 'function') throw new TypeError('sleep 함수가 필요합니다')
  sleepImpl = fn
}

export function resetSleep() {
  sleepImpl = realSleep
}

/** 현재 시각(ms) */
export function now() {
  return nowImpl()
}

export function setNow(fn) {
  if (typeof fn !== 'function') throw new TypeError('now 함수가 필요합니다')
  nowImpl = fn
}

export function resetNow() {
  nowImpl = realNow
}

/** since 뒤로 지난 시간(ms) */
export function elapsed(since) {
  return now() - since
}
