// guard: 멀쩡한 항목은 한 글자도 바뀌지 않았다 (파일 이름과 내용)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './knowledge-helpers.js'

const HEALTHY = {
  'docs/knowledge/routing/window-grace.md': '5a8df0f97f512fa3ffbfc45fc0448dd85d91bf67bf4fbc06026aecdf56a43bf7',
  'docs/knowledge/couriers/max-stops.md': '890eddd05a9230b2e291f643393e02db6c20c8aa79a4bd8e57638624bf8792c0',
  'docs/knowledge/geo/zone-boundary.md': '7be6072d40f63480e52fb340e934ef97489af49b5a7774e8ce3295f91cf78ad5',
  'docs/knowledge/ops/courier-app-v2.md': 'ca8fafe80465cfee3df428b2f3d2e5c922b34a547e614de71e5c627bcac9f319',
}

for (const [rel, sha] of Object.entries(HEALTHY)) {
  test(`그대로: ${rel}`, () => {
    const file = path.join(ROOT, rel)
    assert.ok(fs.existsSync(file), `${rel}가 없어졌거나 옮겨짐`)
    const got = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    assert.equal(got, sha, `${rel}의 내용이 바뀜`)
  })
}
