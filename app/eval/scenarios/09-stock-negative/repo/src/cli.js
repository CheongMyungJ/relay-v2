#!/usr/bin/env node
// 샘플 데이터로 리포트를 찍어 본다.
//   node src/cli.js report | sales | stock <sku>
import { createService } from './index.js'

const [command = 'report', arg] = process.argv.slice(2)
const svc = createService({ config: { log: { level: 'warn' } } })

switch (command) {
  case 'report':
    console.log(svc.reports.stock().text)
    break
  case 'sales':
    console.log(svc.reports.sales().text)
    break
  case 'stock': {
    if (!arg) {
      console.error('SKU를 주세요: node src/cli.js stock A-100')
      process.exit(1)
    }
    for (const r of svc.inventory.records(arg)) {
      console.log(`${r.sku} ${r.warehouse} 실재고 ${r.onHand} 예약 ${r.reserved} 가용 ${r.onHand - r.reserved}`)
    }
    break
  }
  default:
    console.error(`모르는 명령: ${command}`)
    process.exit(1)
}
