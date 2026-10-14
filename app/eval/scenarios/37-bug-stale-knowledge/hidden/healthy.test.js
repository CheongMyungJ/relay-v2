import { test } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import fs from 'node:fs'

// 문제가 없는 항목은 한 글자도 바뀌지 않아야 한다
const HEALTHY = {
  "docs/knowledge/shipping/cutoff-time.md": "36cf9510bb7dd903c2ba8b68c24663291be35549c565fe54d085e065ad76aad9",
  "docs/knowledge/returns/refund-method.md": "d4dae7794dc5c9a963f9ba5365e7738e100185174d141ee8f94e51b9190e9dc6",
  "docs/knowledge/orders/order-number.md": "5817dee496a9c88f5aeda0a41f2499883cf5ffc2bfcf9858a9d04a18a00e1d77",
  "docs/knowledge/orders/test-dates.md": "217f10656a0aa0bfd757df9fa7494f66a9731e07859a173bd16b024d529795ab"
}

test('멀쩡한 항목은 그대로다', () => {
  for (const [p, sha] of Object.entries(HEALTHY)) {
    assert.ok(fs.existsSync(p), `지워짐: ${p}`)
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), sha, `바뀜: ${p}`)
  }
})
