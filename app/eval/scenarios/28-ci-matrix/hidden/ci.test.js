import { test } from 'node:test'
import assert from 'node:assert'
import { spawnSync } from 'node:child_process'
import { allNodeVersions, pkg, root, workflows } from './ci-util.js'

// lint와 테스트는 한 워크플로에 있어도, 따로 있어도 된다 (PR #29 리뷰)
test('CI가 lint와 테스트를 Node 20, 22 행렬로 돈다', () => {
  const all = workflows()
  assert.ok(all.some((t) => /npm (run )?test|npm t\b/.test(t)), 'npm test를 도는 워크플로가 없음')
  assert.ok(all.some((t) => /npm run lint/.test(t)), 'CI에 lint 단계가 없음')
  const versions = allNodeVersions()
  for (const v of [20, 22]) assert.ok(versions.includes(v), `Node ${v}가 없음 (지금: ${versions})`)
})

test('lint 스크립트가 있고 통과한다', () => {
  assert.ok(pkg().scripts?.lint, 'package.json에 lint 스크립트가 없음')
  const r = spawnSync('npm', ['run', 'lint', '--silent'], { cwd: root, encoding: 'utf8' })
  assert.strictEqual(r.status, 0, `npm run lint 실패: ${r.stdout}${r.stderr}`)
})
