import { test } from 'node:test'
import assert from 'node:assert'
import { entries } from './kn.js'

test('연체료(DAILY_FINE)의 중복이 한 항목으로 합쳐지고 두 사실(장애인 면제, 다음 날부터)이 남았다', () => {
  const all = entries()
  const same = all.filter((e) => e.anchor === 'DAILY_FINE').map((e) => e.path)
  assert.ok(same.length <= 1, `anchor DAILY_FINE: ${same.join(', ')}`)
  const merged = all.filter((e) => /장애인/.test(e.body) && /다음\s*날/.test(e.body))
  assert.equal(merged.length, 1, merged.map((e) => e.path).join(', '))
  const rest = all.filter(
    (e) => !merged.includes(e) && /연체료/.test(e.body) && /100원/.test(e.body),
  )
  assert.deepEqual(
    rest.map((e) => e.path),
    [],
  )
})
