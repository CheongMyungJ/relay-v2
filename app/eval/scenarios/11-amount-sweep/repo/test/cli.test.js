import { test } from 'node:test'
import assert from 'node:assert'
import path from 'node:path'
import { main, parseArgs } from '../src/cli.js'
import { setLevel } from '../src/log.js'

const SAMPLE = path.join(import.meta.dirname, '..', 'samples', 'ledger-2026q1.csv')

function capture() {
  let text = ''
  return { stdout: { write: (s) => (text += s) }, text: () => text }
}

test('인자 읽기', () => {
  assert.deepStrictEqual(parseArgs(['vat', 'a.csv', '--year', '2026', '--as-of', '2026-03-31', '--lenient']), {
    _: ['vat', 'a.csv'],
    year: 2026,
    asOf: '2026-03-31',
    lenient: true,
  })
})

test('예시 원장으로 리포트 뽑기', () => {
  const out = capture()
  assert.strictEqual(main(['monthly', SAMPLE, '--year', '2026', '--output', 'json'], { stdout: out.stdout, env: {} }), 0)
  const months = JSON.parse(out.text())
  assert.strictEqual(months.length, 12)
})

test('권한 없는 리포트', () => {
  setLevel('silent')
  const out = capture()
  try {
    assert.strictEqual(main(['vat', SAMPLE, '--user', '이뷰어:viewer'], { stdout: out.stdout, env: { LEDGER_LOG_LEVEL: 'silent' } }), 4)
  } finally {
    setLevel('info')
  }
})

test('원장 점검', () => {
  const out = capture()
  assert.strictEqual(main(['check', SAMPLE], { stdout: out.stdout, env: {} }), 0)
  assert.match(out.text(), /행 32개/)
})
