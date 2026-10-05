// 연체료 규칙이 한 곳에만 있어야 규칙이 바뀔 때 한 곳만 고친다.
// 비율 숫자(0.5, .5, / 2, 50 / 100)가 있는 파일과 일 대여료를 곱하는 식이 있는 파일을 따로 센다. 둘 다 한 파일 이하여야 한다
// (비율은 설정에, 식은 연체료 모듈에 두는 것처럼 둘이 다른 파일이어도 된다). 대여료(rentals/pricing.js)는 뺀다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const SRC = new URL('../src/', import.meta.url).pathname

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return files(p)
    return /\.(m?js|cjs|ts)$/.test(e.name) ? [p] : []
  })
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1')

const RATE = /(?<![\w.])0?\.5(?![\d])|\/\s*2(?![\d.])|\b50\s*\/\s*100\b/
const DAILY_RATE_MUL = /dailyRate\s*\*|\*\s*[\w.]*dailyRate\b/

const rel = (f) => path.relative(SRC, f).split(path.sep).join('/')
const sources = files(SRC)
  .filter((f) => rel(f) !== 'rentals/pricing.js')
  .map((f) => ({ file: rel(f), code: stripComments(fs.readFileSync(f, 'utf8')) }))

test('연체료 비율이 한 파일에만 있다', () => {
  const hits = sources.filter((s) => RATE.test(s.code)).map((s) => s.file)
  assert.ok(hits.length <= 1, `연체료 비율이 여러 파일에 있다: ${hits.join(', ')}`)
})

test('연체료 계산식이 한 파일에만 있다', () => {
  const hits = sources.filter((s) => DAILY_RATE_MUL.test(s.code)).map((s) => s.file)
  assert.ok(hits.length <= 1, `연체료 계산식이 여러 파일에 있다: ${hits.join(', ')}`)
})
