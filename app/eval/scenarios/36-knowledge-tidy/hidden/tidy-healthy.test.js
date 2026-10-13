import { test } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import fs from 'node:fs'

// 문제가 없는 항목은 한 글자도 바뀌지 않아야 한다
const HEALTHY = {
  "docs/knowledge/coupon/max-rate.md": "bce80d2de671cc5bdb41d7fe58b587f140591705d1368a3ed63dc8334fe9ac2e",
  "docs/knowledge/coupon/expiry-kst.md": "75a4b47780e8a30b2a3c458ba5163010e3b7d3ae67d397bbe81c27479b93fec2",
  "docs/knowledge/coupon/rounding.md": "d0628571610f8297f6f2061ae3e5f6ddec5497e6e3d6fcfd0f618033b57ef47f",
  "docs/knowledge/coupon/test-clock.md": "d32c82c6e2614b0364320100845f6db8ed5cdbc16bd3ffd7d335555ecb6efcb2"
}

test('멀쩡한 항목은 그대로다', () => {
  for (const [p, sha] of Object.entries(HEALTHY)) {
    assert.ok(fs.existsSync(p), `지워짐: ${p}`)
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), sha, `바뀜: ${p}`)
  }
})
