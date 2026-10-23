// 매달 1일 운영 서버의 cron이 돌리는 월간 매출 보고. node scripts/monthly-report.js <매출 JSON 파일>
import fs from 'node:fs'
import { formatPrice } from '../src/price.js'

export function reportLines(sales) {
  const total = sales.reduce((sum, s) => sum + s.amount, 0)
  return [`월간 매출 ${formatPrice(total)}`, `건수 ${sales.length}건`]
}

if (process.argv[2]) {
  const sales = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  console.log(reportLines(sales).join('\n'))
}
