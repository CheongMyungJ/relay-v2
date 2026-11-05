import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isQuietAt, quietEndsAt } from '../src/preferences/quiet-hours.js'
import { createPreferenceStore } from '../src/preferences/store.js'

const SEOUL = 540

test('자정을 넘는 방해 금지 시간', () => {
  const quiet = { start: '22:00', end: '08:00' }
  assert.equal(isQuietAt(Date.parse('2026-09-21T14:30:00Z'), quiet, SEOUL), true) // 서울 23:30
  assert.equal(isQuietAt(Date.parse('2026-09-20T22:59:00Z'), quiet, SEOUL), true) // 서울 07:59
  assert.equal(isQuietAt(Date.parse('2026-09-20T23:00:00Z'), quiet, SEOUL), false) // 서울 08:00
  assert.equal(isQuietAt(Date.parse('2026-09-21T01:00:00Z'), undefined, SEOUL), false)
})

test('방해 금지가 끝나는 시각', () => {
  const quiet = { start: '22:00', end: '08:00' }
  const end = quietEndsAt(Date.parse('2026-09-21T14:30:00Z'), quiet, SEOUL)
  assert.equal(new Date(end).toISOString(), '2026-09-21T23:00:00.000Z')
})

test('기본값과 수신 거부', () => {
  const store = createPreferenceStore({ 'u-1': { email: 'mina@example.com' } })
  assert.equal(store.get('u-1').locale, 'ko')
  assert.deepEqual(store.get('nobody').pushTokens, [])
  store.optOut('u-1', 'push')
  store.optOut('u-1', 'push')
  assert.deepEqual(store.get('u-1').optOut, ['push'])
  store.optIn('u-1', 'push')
  assert.deepEqual(store.get('u-1').optOut, [])
})

test('잘못된 메일 주소는 거절', () => {
  const store = createPreferenceStore()
  assert.throws(() => store.set('u-9', { email: 'not-an-email' }), /메일 주소/)
})
