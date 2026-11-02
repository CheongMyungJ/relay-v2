import { test } from 'node:test'
import assert from 'node:assert'
import { exportMembers } from '../src/members.js'

test('CSV 머리글과 가린 이메일', () => {
  const csv = exportMembers([
    { id: 1, name: '김철수', email: 'kim@example.com' },
    { id: 2, name: 'Lee, Young', email: 'y@b.kr' },
  ])
  assert.strictEqual(csv, 'id,name,email\n1,김철수,k***@example.com\n2,"Lee, Young",y***@b.kr')
})

test('빈 목록은 머리글만', () => {
  assert.strictEqual(exportMembers([]), 'id,name,email')
})
