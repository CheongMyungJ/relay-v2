import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname

test('money를 2.0.0으로 올렸다: #money가 2.0.0을 가리키고 src가 1.4.0을 쓰지 않는다', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.match(String(pkg.imports?.['#money'] ?? ''), /money@2\.0\.0/)
  for (const f of fs.readdirSync(path.join(root, 'src')))
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'src', f), 'utf8'), /1\.4\.0|formatWon/, f)
})
