import { test } from 'node:test'
import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

// 테스트가 덮지 않는 운영 스크립트: 매달 cron이 돈다
test('월간 보고 스크립트가 그대로 돈다', () => {
  const data = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sales-')), 'sales.json')
  fs.writeFileSync(data, JSON.stringify([{ amount: 12000 }, { amount: 3500 }]))
  const out = execFileSync('node', [path.join(root, 'scripts', 'monthly-report.js'), data], {
    encoding: 'utf8',
  })
  assert.strictEqual(out, '월간 매출 15,500원\n건수 2건\n')
})
