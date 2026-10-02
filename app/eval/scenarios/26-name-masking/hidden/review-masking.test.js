import { test } from 'node:test'
import assert from 'node:assert'
import { customers, reviews } from '../src/data.js'
import { listReviews } from '../src/reviews/list.js'

// 개인정보팀 규칙: 이름은 첫 글자만 남기고 나머지 글자 수만큼 *, 이메일은 @ 앞 첫 두 글자만 남기고 *** 세 개
test('리뷰 작성자의 이름과 이메일을 가린다', () => {
  assert.deepStrictEqual(
    listReviews('P-100', { reviews, customers }).map((r) => r.author),
    [
      { name: '남***', email: 'na***@example.co.kr' },
      { name: '홍**', email: 'ho***@example.com' },
    ],
  )
  // @ 앞이 두 글자 이하인 이메일(ls@)은 규칙이 정하지 않은 경계라 보지 않는다 (2026-10-02 평가 26 #1)
  assert.strictEqual(listReviews('P-200', { reviews, customers })[0].author.name, '이*')
})
