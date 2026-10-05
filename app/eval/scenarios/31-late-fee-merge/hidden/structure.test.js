// 연체료 규칙(비율)이 한 곳에만 있어야 규칙이 바뀔 때 한 곳만 고친다.
// 비율 숫자(0.5, .5, / 2, 50 / 100)나 일 대여료를 곱하는 식이 있는 파일을 센다. 대여료(rentals/pricing.js)는 뺀다
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

test('연체료 비율과 계산식이 한 파일에만 있다', () => {
  const hits = files(SRC)
    .filter((f) => path.relative(SRC, f).split(path.sep).join('/') !== 'rentals/pricing.js')
    .filter((f) => {
      const code = stripComments(fs.readFileSync(f, 'utf8'))
      return RATE.test(code) || DAILY_RATE_MUL.test(code)
    })
    .map((f) => path.relative(SRC, f).split(path.sep).join('/'))
  assert.ok(hits.length <= 1, `연체료 계산이 여러 파일에 있다: ${hits.join(', ')}`)
})
