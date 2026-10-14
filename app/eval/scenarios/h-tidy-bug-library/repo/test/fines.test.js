import { test } from 'node:test'
import assert from 'node:assert'
import { lateFine } from '../src/fines.js'
import { cardNumber } from '../src/members.js'

test('연체료는 하루씩 붙고 상한에서 멈춘다', () => {
  assert.equal(lateFine(0), 0)
  assert.equal(lateFine(4), 400)
  assert.equal(lateFine(45), 3000)
})

test('회원증 번호 형식', () => {
  assert.equal(cardNumber('03', 42), '03-000042')
})
