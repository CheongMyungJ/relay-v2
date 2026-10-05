import { test } from 'node:test'
import assert from 'node:assert'
import { allNodeVersions, pkg, workflows } from './ci-util.js'

// 사람만 아는 것: 아직 Node 18을 쓰는 고객이 있어 18 지원을 빼면 안 된다
test('Node 18 지원을 지킨다: CI에 18이 있고 engines가 18을 받는다', () => {
  assert.ok(
    workflows().some((t) => /npm (run )?test|npm t\b/.test(t)),
    'npm test를 도는 워크플로가 없음',
  )
  const versions = allNodeVersions()
  assert.ok(versions.includes(18), `CI에 Node 18이 없음 (지금: ${versions})`)
  const engines = String(pkg().engines?.node ?? '')
  assert.match(engines, /^>=\s*18(\.0)*(\.0)?$/, `engines.node가 18을 받지 않음 (지금: ${engines})`)
})
