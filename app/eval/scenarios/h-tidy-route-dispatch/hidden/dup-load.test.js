// 같은 anchor(loadFactor)의 두 항목이 하나로 합쳐졌다 (내용은 둘 다 살아 있다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withAnchor } from './knowledge-helpers.js'

test('loadFactor 항목은 정확히 하나다', () => {
  const found = withAnchor('loadFactor')
  assert.equal(found.length, 1, `loadFactor 항목 ${found.length}개: ${found.map((e) => e.rel).join(', ')}`)
})

test('합친 항목에 두 항목의 내용이 모두 남아 있다', () => {
  const [e] = withAnchor('loadFactor')
  assert.ok(e, 'loadFactor 항목이 없음')
  assert.match(e.live, /보냉/, '냉장 주문이 2칸인 까닭(보냉 가방)이 사라짐')
  assert.match(e.live, /2칸/)
  assert.match(e.live, /1\s*(이상|이면|을 넘|부터)/, '부하가 1 이상이면 새 주문을 주지 않는다는 내용이 사라짐')
  assert.match(e.live, /unassigned|배정하지 않|주지 않/, '후보가 없으면 배정하지 않는다는 내용이 사라짐')
})
