import fs from 'node:fs'
import { cartBanner } from './banner.js'
import { checkoutAmounts } from './checkout.js'

const file = process.argv[2]
if (!file) {
  console.error('쓰는 법: node src/cli.js <장바구니 파일>')
  process.exit(1)
}
const cart = JSON.parse(fs.readFileSync(file, 'utf8'))
console.log(cartBanner(cart))
console.log(checkoutAmounts(cart))
