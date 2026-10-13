// 같은 anchor(assignOrders)의 두 항목이 하나로 합쳐졌다 (내용은 둘 다 살아 있다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withAnchor } from './knowledge-helpers.js'

test('assignOrders 항목은 정확히 하나다', () => {
  const found = withAnchor('assignOrders')
  assert.equal(found.length, 1, `assignOrders 항목 ${found.length}개: ${found.map((e) => e.rel).join(', ')}`)
})

test('합친 항목에 두 항목의 내용이 모두 남아 있다', () => {
  const [e] = withAnchor('assignOrders')
  assert.ok(e, 'assignOrders 항목이 없음')
  assert.match(e.live, /주문\s*id/, '주문을 id 순으로 처리한다는 내용이 사라짐')
  assert.match(e.live, /기사\s*id[^\n]{0,12}(작은|낮은|앞선|먼저)/, '부하가 같으면 기사 id가 작은 쪽이라는 내용이 사라짐')
  assert.match(e.live, /priorityOf/)
})
