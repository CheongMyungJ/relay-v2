import { test } from 'node:test'
import assert from 'node:assert'
import { addDays, daysBetween, formatDateDots, formatDateKo, isValidDate } from '../src/format/date.js'
import { formatNumber, formatWon, wonInWords } from '../src/format/won.js'
import { centerW, displayWidth, padEndW, padStartW, truncateW } from '../src/format/width.js'

test('금액 서식', () => {
  assert.strictEqual(formatNumber(0), '0')
  assert.strictEqual(formatNumber(999), '999')
  assert.strictEqual(formatNumber(1000), '1,000')
  assert.strictEqual(formatNumber(-1234567), '-1,234,567')
  assert.strictEqual(formatWon(29082), '29,082원')
})

test('한글 금액', () => {
  assert.strictEqual(wonInWords(0), '금 영원정')
  assert.strictEqual(wonInWords(29082), '금 이만구천팔십이원정')
  assert.strictEqual(wonInWords(110000), '금 십일만원정')
  assert.strictEqual(wonInWords(1000000), '금 백만원정')
  assert.strictEqual(wonInWords(120000500), '금 일억이천만오백원정')
})

test('글자 폭', () => {
  assert.strictEqual(displayWidth('abc'), 3)
  assert.strictEqual(displayWidth('볼펜 0.5'), 8)
  assert.strictEqual(padEndW('합계', 6), '합계  ')
  assert.strictEqual(padStartW('1,000', 7), '  1,000')
  assert.strictEqual(centerW('청구서', 10), '  청구서  ')
  assert.strictEqual(truncateW('스테이플러 심 대용량', 10), '스테이플…')
  assert.strictEqual(truncateW('짧음', 10), '짧음')
})

test('날짜', () => {
  assert.strictEqual(formatDateKo('2026-09-14'), '2026년 9월 14일')
  assert.strictEqual(formatDateDots('2026-09-14'), '2026.09.14')
  assert.strictEqual(isValidDate('2026-02-29'), false)
  assert.strictEqual(isValidDate('2028-02-29'), true)
  assert.strictEqual(addDays('2026-12-31', 1), '2027-01-01')
  assert.strictEqual(daysBetween('2026-09-14', '2026-10-14'), 30)
})
