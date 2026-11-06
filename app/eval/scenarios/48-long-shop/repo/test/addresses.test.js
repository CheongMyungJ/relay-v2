import assert from 'node:assert/strict'
import { test } from 'node:test'
import { regionOf } from '../src/customers/addresses.js'
import { errorCode, setup } from './helpers.js'

test('우편번호로 배송 지역', () => {
  assert.equal(regionOf('06236'), 'seoul')
  assert.equal(regionOf('13529'), 'metro')
  assert.equal(regionOf('48058'), 'local')
  assert.equal(regionOf('63100'), 'jeju')
  assert.equal(regionOf('40220'), 'island')
  assert.equal(regionOf('58830'), 'island')
  assert.throws(() => regionOf('1234'), errorCode('BAD_POSTCODE'))
})

test('첫 주소가 기본이고 기본 주소의 지역이 고객 지역이 된다', () => {
  const shop = setup()
  const home = shop.addresses.add('u-1', { recipient: '최유나', postcode: '06236', line1: '서울 강남구 테헤란로 1' })
  assert.equal(home.isDefault, true)
  const jeju = shop.addresses.add('u-1', { label: '본가', recipient: '최유나', postcode: '63100', line1: '제주시 1', makeDefault: true })
  assert.equal(shop.customers.get('u-1').region, 'jeju')
  assert.deepEqual(shop.addresses.list('u-1').map((a) => a.isDefault), [false, true])
  shop.addresses.remove('u-1', jeju.id)
  assert.equal(shop.addresses.defaultOf('u-1').id, home.id)
  assert.equal(shop.customers.get('u-1').region, 'seoul')
})

test('주소 검사', () => {
  const shop = setup()
  assert.throws(() => shop.addresses.add('u-1', { postcode: '06236', line1: 'x' }), errorCode('BAD_ADDRESS'))
  assert.throws(() => shop.addresses.add('u-1', { recipient: 'a', postcode: 'abcde', line1: 'x' }), errorCode('BAD_POSTCODE'))
  assert.throws(() => shop.addresses.list('nobody'), errorCode('NOT_FOUND'))
})
