import { test } from 'node:test'
import assert from 'node:assert'
import { customers, reviews } from '../src/data.js'
import { listReviews } from '../src/reviews/list.js'

test('상품의 리뷰만 최신순으로', () => {
  const got = listReviews('P-100', { reviews, customers })
  assert.deepStrictEqual(got.map((r) => r.id), ['R-2', 'R-1'])
})
