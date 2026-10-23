import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as price from '../src/price.js'

const root = fileURLToPath(new URL('..', import.meta.url))

test('formatPrice가 없어지고 src와 scripts가 쓰지 않는다', () => {
  assert.strictEqual('formatPrice' in price, false)
  for (const dir of ['src', 'scripts']) {
    for (const f of fs.readdirSync(path.join(root, dir), { recursive: true })) {
      const file = path.join(root, dir, String(f))
      if (!fs.statSync(file).isFile()) continue
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /formatPrice/, `${dir}/${f}`)
    }
  }
})
