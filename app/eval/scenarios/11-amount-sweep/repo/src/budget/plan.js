import { ParseError } from '../util/errors.js'

// 예산 계획 파일. 한 줄에 '계정코드 = 금액' 하나. # 뒤는 주석
//   5110 = ₩500,000
//   5200 = ₩1,200,000
// 금액은 적힌 문자열 그대로 둔다
export function parsePlan(text) {
  const plan = {}
  String(text)
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.replace(/#.*/, '').trim()
      if (!line) return
      const eq = line.indexOf('=')
      if (eq < 0) throw new ParseError(`'=' 가 없음: ${raw}`, i + 1)
      const account = line.slice(0, eq).trim()
      const amount = line.slice(eq + 1).trim()
      if (!/^\d{4}$/.test(account)) throw new ParseError(`계정코드가 이상함: ${account}`, i + 1)
      if (account in plan) throw new ParseError(`같은 계정이 두 번 나옴: ${account}`, i + 1)
      plan[account] = amount
    })
  return plan
}

export function planAccounts(plan) {
  return Object.keys(plan).sort()
}
