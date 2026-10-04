import { test } from 'node:test'
import assert from 'node:assert'
import { createCustomer, formatBizNo, isValidBizNo } from '../src/customers/customer.js'
import { createCustomerStore } from '../src/customers/store.js'
import { isOnCreditHold, paymentDays } from '../src/customers/terms.js'

const seed = [
  { id: 'C-0412', name: '(주)세림건축', bizNo: '214-86-12341', grade: 'B' },
  { id: 'C-0388', name: '누리테크 주식회사', bizNo: '105-87-11900', grade: 'A', email: 'Finance@NuriTech.kr' },
]

test('사업자등록번호 검증', () => {
  assert.strictEqual(isValidBizNo('120-81-47521'), true)
  assert.strictEqual(isValidBizNo('1208147521'), true)
  assert.strictEqual(isValidBizNo('120-81-47522'), false)
  assert.strictEqual(isValidBizNo('12081475'), false)
  assert.strictEqual(formatBizNo('2148612341'), '214-86-12341')
})

test('고객 만들기', () => {
  const c = createCustomer(seed[1])
  assert.strictEqual(c.bizNo, '1058711900')
  assert.strictEqual(c.email, 'finance@nuritech.kr')
  assert.strictEqual(c.zeroRated, false)
  assert.throws(() => createCustomer({ ...seed[0], bizNo: '214-86-12340' }), /사업자등록번호/)
  assert.throws(() => createCustomer({ ...seed[0], grade: 'S' }), /등급/)
  assert.throws(() => createCustomer({ ...seed[0], email: 'no-at-sign' }), /이메일/)
})

test('고객 목록', () => {
  const store = createCustomerStore(seed)
  assert.strictEqual(store.size, 2)
  assert.strictEqual(store.get('C-0412').name, '(주)세림건축')
  assert.strictEqual(store.findByBizNo('1058711900').id, 'C-0388')
  assert.deepStrictEqual(store.search('누리 테크').map((c) => c.id), ['C-0388'])
  assert.throws(() => store.add({ ...seed[0], id: 'C-9999' }), /이미 등록된/)
  assert.throws(() => store.require('C-0000'), /찾지 못함/)
})

test('고객 정보 바꾸기', () => {
  const store = createCustomerStore(seed)
  const c = store.update('C-0412', { grade: 'A' })
  assert.strictEqual(c.grade, 'A')
  assert.throws(() => store.update('C-0412', { bizNo: '105-87-11900' }), /이미 등록된/)
  assert.strictEqual(store.remove('C-0412'), true)
  assert.strictEqual(store.get('C-0412'), null)
})

test('결제 조건', () => {
  assert.strictEqual(paymentDays({ grade: 'A' }), 45)
  assert.strictEqual(paymentDays({ grade: 'C' }), 15)
  assert.strictEqual(paymentDays(undefined), 30)
  assert.strictEqual(isOnCreditHold({ grade: 'C' }, 1), true)
  assert.strictEqual(isOnCreditHold({ grade: 'A' }, 45), false)
})
