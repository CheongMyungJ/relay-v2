import { config } from '../config.js'
import { formatWon } from '../util/money.js'

/** 결제 영수증 글 */
export function receiptText({ memberName, planName, amount, billedOn }) {
  const supply = Math.round(amount / 1.1)
  return [
    `${config.serviceName} 결제 영수증`,
    `${memberName}님 · ${billedOn}`,
    `${planName}  ${formatWon(amount)}`,
    `(공급가액 ${formatWon(supply)}, 부가세 ${formatWon(amount - supply)})`,
  ].join('\n')
}
