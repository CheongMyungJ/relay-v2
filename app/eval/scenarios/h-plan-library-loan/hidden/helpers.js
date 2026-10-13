// 숨긴 시험의 도움: 저장소를 채우고, 거절 코드를 확인한다
import assert from 'node:assert/strict'
import { LoanError, getBook, getLoan, listLoans, resetBooks, resetLoans, resetMembers } from '../src/index.js'

export const book = (over = {}) => ({
  id: 'B-1',
  title: '바다의 지도',
  available: 2,
  priceWon: 12000,
  holds: 0,
  ...over,
})

export const member = (over = {}) => ({ id: 'M-1', name: '가영', ...over })

export const loan = (over = {}) => ({
  id: 'L-0001',
  memberId: 'M-1',
  bookId: 'B-1',
  borrowedOn: '2026-10-06',
  baseDueOn: '2026-10-20',
  dueOn: '2026-10-20',
  renewals: 0,
  returnedOn: null,
  feeWon: null,
  ...over,
})

export function setup({ books = [book()], members = [member()], loans = [] } = {}) {
  resetBooks(books)
  resetMembers(members)
  resetLoans(loans)
}

/** fn이 LoanError(code)를 던지는지 */
export function rejects(fn, code) {
  assert.throws(fn, (e) => {
    assert.ok(e instanceof LoanError, `LoanError가 아님: ${e}`)
    assert.equal(e.code, code)
    return true
  })
}

/** 책 여러 권(B-1 … B-n)과 회원 한 명 */
export const manyBooks = (n, over = {}) =>
  Array.from({ length: n }, (_, i) => book({ id: `B-${i + 1}`, title: `책 ${i + 1}`, ...over }))

export { getBook, getLoan, listLoans }
