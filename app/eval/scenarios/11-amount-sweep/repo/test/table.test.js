import { test } from 'node:test'
import assert from 'node:assert'
import { renderTable } from '../src/lib/table.js'
import { displayWidth, truncateWidth, wrapWidth } from '../src/util/strings.js'

test('한글 폭은 2', () => {
  assert.strictEqual(displayWidth('가나a'), 5)
  assert.strictEqual(truncateWidth('가나다라마', 7), '가나다…')
})

test('표 정렬', () => {
  const out = renderTable(
    [
      { key: 'name', title: '이름' },
      { key: 'n', title: 'N', align: 'right' },
    ],
    [
      { name: '가나', n: 1 },
      { name: 'abc', n: 100 },
    ],
  )
  assert.strictEqual(out, ['이름    N', '----  ---', '가나    1', 'abc   100'].join('\n'))
})

test('줄 바꾸기', () => {
  assert.deepStrictEqual(wrapWidth('가나 다라 마바', 9), ['가나 다라', '마바'])
})
