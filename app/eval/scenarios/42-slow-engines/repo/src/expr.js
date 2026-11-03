// 수식 도구. 지금은 숫자인지 보는 것만 있다.

export function isNumber(text) {
  return /^\d+(\.\d+)?$/.test(String(text).trim())
}
