import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, shop, to } from './shop-setup.js'

const promo = (s) => s.notifier.sendPromo(['c-1'], { title: '봄 세일', text: '10%' })
const sms = (s) => to(s.channels.sms, '010-1234-5678')

test('밤 9시 반 광고 문자는 바로 간다', () => {
  const s = shop()
  atKst(s, '2026-03-03 21:30')
  promo(s)
  assert.equal(sms(s).length, 1)
})

test('밤 10시부터 아침 7시까지 광고 문자는 아침 7시로 미룬다', () => {
  const s = shop()
  atKst(s, '2026-03-03 22:00')
  promo(s)
  atKst(s, '2026-03-04 06:30')
  promo(s)
  assert.equal(sms(s).length, 0)
  assert.deepEqual(s.notifier.pending().map((m) => m.dueAt), ['2026-03-03T22:00:00.000Z', '2026-03-03T22:00:00.000Z'])
  atKst(s, '2026-03-04 06:59')
  s.notifier.flush()
  assert.equal(sms(s).length, 0)
  atKst(s, '2026-03-04 07:00')
  s.notifier.flush()
  assert.equal(sms(s).length, 2)
})

test('아침 7시 광고는 바로 간다', () => {
  const s = shop()
  atKst(s, '2026-03-04 07:00')
  promo(s)
  assert.equal(sms(s).length, 1)
})
