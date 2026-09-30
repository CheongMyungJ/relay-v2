import { test } from 'node:test'
import assert from 'node:assert'
import { normalize } from '../src/text/normalize.js'
import { stripParticle, tokenize, uniqueTokens } from '../src/text/tokenize.js'
import { expandTerms, synonymsOf } from '../src/text/synonyms.js'
import { isChoseongOnly, toChoseong } from '../src/text/hangul.js'

test('정규화: 전각, 대소문자, 기호', () => {
  assert.strictEqual(normalize('ＳＴＡＮＬＥＹ  Tumbler!!'), 'stanley tumbler')
  assert.strictEqual(normalize('1L/500ml'), '1l 500ml')
  assert.strictEqual(normalize(null), '')
})

test('단어 쪼개기와 불용어', () => {
  assert.deepStrictEqual(tokenize('스탠리 클래식 텀블러 1L'), ['스탠리', '클래식', '텀블러', '1l'])
  assert.deepStrictEqual(tokenize('캠핑 및 등산용'), ['캠핑', '등산용'])
  assert.deepStrictEqual(tokenize('the best of'), ['best'])
})

test('조사 떼기는 세 글자 이상만', () => {
  assert.strictEqual(stripParticle('텀블러를'), '텀블러')
  assert.strictEqual(stripParticle('캠핑에서'), '캠핑')
  assert.strictEqual(stripParticle('도마'), '도마')
  assert.strictEqual(stripParticle('tumbler'), 'tumbler')
})

test('중복 없는 단어', () => {
  assert.deepStrictEqual(uniqueTokens('보온 보냉 보온'), ['보온', '보냉'])
})

test('동의어 확장', () => {
  assert.deepStrictEqual(synonymsOf('텀블러'), ['보온병', '보틀'])
  assert.deepStrictEqual(synonymsOf('도마'), [])
  const expanded = expandTerms(['텀블러', '보틀'])
  assert.deepStrictEqual(expanded.map((t) => [t.term, t.weight]), [['텀블러', 1], ['보틀', 1], ['보온병', 0.5]])
  assert.strictEqual(expandTerms(['텀블러'], { enabled: false }).length, 1)
})

test('초성', () => {
  assert.strictEqual(toChoseong('텀블러'), 'ㅌㅂㄹ')
  assert.strictEqual(toChoseong('LG 그램'), 'lg ㄱㄹ')
  assert.ok(isChoseongOnly('ㅌㅂㄹ'))
  assert.ok(!isChoseongOnly('ㅌ'))
  assert.ok(!isChoseongOnly('텀ㅂ'))
})
