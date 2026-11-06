import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isEmail, normalizePhone } from '../src/customers/customers.js'
import { errorCode, setup } from './helpers.js'

test('전화번호를 하나의 꼴로', () => {
  assert.equal(normalizePhone('01012345678'), '010-1234-5678')
  assert.equal(normalizePhone('+82 10-1234-5678'), '010-1234-5678')
  assert.equal(normalizePhone('011-123-4567'), '011-123-4567')
  assert.equal(normalizePhone('02-123-4567'), null)
  assert.equal(normalizePhone(''), null)
})

test('메일 주소', () => {
  assert.equal(isEmail('a@b.co'), true)
  assert.equal(isEmail('a@b'), false)
})

test('고객 등록과 고치기', () => {
  const shop = setup()
  assert.equal(shop.customers.get('u-2').phone, '010-4444-5555')
  assert.throws(() => shop.customers.register({ id: 'u-1', name: 'x' }), errorCode('DUPLICATE_CUSTOMER'))
  assert.throws(() => shop.customers.register({ id: 'u-9', name: 'x', phone: '12' }), errorCode('BAD_CUSTOMER'))
  assert.throws(() => shop.customers.register({ id: 'u-9', name: 'x', region: 'mars' }), errorCode('BAD_CUSTOMER'))
  const c = shop.customers.update('u-3', { phone: '010 7777 8888', tier: 'vip' })
  assert.equal(c.phone, '010-7777-8888')
  assert.equal(c.tier, 'vip')
  assert.throws(() => shop.customers.update('u-3', { locale: 'fr' }), errorCode('BAD_CUSTOMER'))
})
