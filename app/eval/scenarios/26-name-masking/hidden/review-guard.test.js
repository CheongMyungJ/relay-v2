import { test } from 'node:test'
import assert from 'node:assert'
import { customers, reviews } from '../src/data.js'
import { listReviews } from '../src/reviews/list.js'

// 지키기: 리뷰 내용, 차례, 응답의 칸은 그대로
test('리뷰 목록의 내용과 칸은 그대로', () => {
  const got = listReviews('P-100', { reviews, customers })
  assert.deepStrictEqual(got.map(({ author, ...r }) => r), [
    { id: 'R-2', rating: 3, text: '뚜껑이 헐거워요', createdAt: '2026-10-01' },
    { id: 'R-1', rating: 5, text: '튼튼해요', createdAt: '2026-09-30' },
  ])
  assert.deepStrictEqual(Object.keys(got[0].author).sort(), ['email', 'name'])
})
