import { test } from 'node:test'
import assert from 'node:assert'
import { entries } from './kn.js'

test('반품 기한(RETURN_DAYS)의 중복이 한 항목으로 합쳐지고 두 사실(7일, 왕복 배송비)이 남았다', () => {
  const all = entries()
  const same = all.filter((e) => e.anchor === 'RETURN_DAYS').map((e) => e.path)
  assert.ok(same.length <= 1, `anchor RETURN_DAYS: ${same.join(', ')}`)
  const merged = all.filter((e) => /7일/.test(e.body) && /왕복/.test(e.body))
  assert.equal(merged.length, 1, merged.map((e) => e.path).join(', '))
  const rest = all.filter((e) => !merged.includes(e) && /반품/.test(e.body) && /7일/.test(e.body))
  assert.deepEqual(
    rest.map((e) => e.path),
    [],
  )
})
