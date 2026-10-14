// guard: 정리한 뒤에도 모든 지식 파일이 형식에 맞는다 (머리글 kind·source·anchor, 제목, 본문 절)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entries, parse, section } from './knowledge-helpers.js'

const KINDS = ['rule', 'fact', 'history', 'pitfall']
const SOURCES = ['human', 'investigation']
const SECTIONS = ['규칙', '내용', '아직 규칙을 따르지 않는 곳', '아직 정하지 않은 것', '바뀐 이력']
const ANCHOR = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/

test('지식 파일이 있다', () => {
  assert.ok(entries().length >= 5)
})

for (const e of entries()) {
  test(`형식: ${e.rel}`, () => {
    assert.ok(parse(e.text), '머리글(---)이 없음')
    assert.match(e.rel, /^docs\/knowledge\/[a-z0-9-]+\/[^/]+\.md$/, '경로는 docs/knowledge/<영역>/<이름>.md')
    assert.ok(KINDS.includes(e.data.kind), `kind: ${e.data.kind}`)
    assert.ok(SOURCES.includes(e.data.source), `source: ${e.data.source}`)
    if (e.data.anchor !== undefined) assert.match(e.data.anchor, ANCHOR, `anchor: ${e.data.anchor}`)
    assert.ok(e.title.trim(), '첫 # 제목이 없음')
    const main = e.data.kind === 'rule' ? '규칙' : '내용'
    assert.ok((section(e.body, main) ?? '').trim(), `## ${main} 절이 없거나 비었음`)
    for (const h of [...e.body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()))
      assert.ok(SECTIONS.includes(h), `모르는 절: ${h}`)
  })
}
