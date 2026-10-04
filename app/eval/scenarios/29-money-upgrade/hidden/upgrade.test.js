import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// .pathname은 퍼센트 인코딩된 글이고 Windows에서는 /C:/… 꼴이라 경로로 쓰지 않는다 (PR #29 리뷰)
const root = fileURLToPath(new URL('..', import.meta.url))

test('money를 2.0.0으로 올렸다: #money가 2.0.0을 가리키고 src가 1.4.0을 쓰지 않는다', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.match(String(pkg.imports?.['#money'] ?? ''), /money@2\.0\.0/)
  // src 아래 폴더도 본다 (PR #29 리뷰)
  const src = path.join(root, 'src')
  for (const f of fs.readdirSync(src, { recursive: true })) {
    const file = path.join(src, String(f))
    if (!fs.statSync(file).isFile()) continue
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /1\.4\.0|formatWon/, String(f))
  }
})
