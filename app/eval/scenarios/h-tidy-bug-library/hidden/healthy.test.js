import { test } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import fs from 'node:fs'

// 문제가 없는 항목은 한 글자도 바뀌지 않아야 한다
const HEALTHY = {
  'docs/knowledge/loans/new-release.md':
    'c226440c602af706b1f19b4351607a32e8f21024a0f0db48112eb12ff51af229',
  'docs/knowledge/loans/test-clock.md':
    'c7e758e23957631c4a1f1a1f6741b4b375a55feaa72de00eb796d6ac83c6add8',
  'docs/knowledge/fines/fine-cap.md':
    '3da32774f72d069c0019c46164a6ec3b9e835ecb93981744bccd0a2c850cb4e1',
  'docs/knowledge/members/card-number.md':
    '9e9c20b0fb968905b6c820830c90df72dc21f2085a8ed9017b854e627b93748c',
}

test('멀쩡한 항목은 그대로다', () => {
  for (const [p, sha] of Object.entries(HEALTHY)) {
    assert.ok(fs.existsSync(p), `지워짐: ${p}`)
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
      sha,
      `바뀜: ${p}`,
    )
  }
})
