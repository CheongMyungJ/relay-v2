import assert from 'node:assert/strict'
import { test } from 'node:test'
import { catalog } from '../src/templates/catalog.js'
import { createTemplateRegistry, validateCatalog } from '../src/templates/registry.js'
import { render, TemplateError, variablesOf } from '../src/templates/render.js'

test('값과 필터를 채운다', () => {
  assert.equal(render('{{name}}님 {{amount | won}}', { name: '미나', amount: 12500 }), '미나님 12,500원')
  assert.equal(render('{{user.name | upper}}', { user: { name: 'sam' } }), 'SAM')
  assert.equal(render('{{email | mask}}', { email: 'mina@example.com' }), 'm***@example.com')
})

test('없는 값과 모르는 필터는 오류', () => {
  assert.throws(() => render('{{missing}}', {}), TemplateError)
  assert.throws(() => render('{{a | nope}}', { a: 1 }), /모르는 필터/)
})

test('템플릿의 변수 목록', () => {
  assert.deepEqual(variablesOf('{{a}} {{ b.c | upper }}'), ['a', 'b.c'])
})

test('언어가 없으면 기본 언어로', () => {
  const registry = createTemplateRegistry({ defaultLocale: 'ko' })
  const text = registry.renderFor('order.delivered', 'push', 'ja', { orderNo: 'A-1' })
  assert.equal(text.title, '배송 완료')
})

test('채널과 필수 여부', () => {
  const registry = createTemplateRegistry()
  assert.deepEqual(registry.channelsFor('order.shipped'), ['mail', 'push'])
  assert.equal(registry.isRequired('password.reset'), true)
  assert.equal(registry.isRequired('order.shipped'), false)
  assert.throws(() => registry.channelsFor('order.lost'), /템플릿 없음/)
})

test('전화번호와 긴 글 필터', () => {
  assert.equal(render('{{p | phone}}', { p: '01012345678' }), '010-1234-5678')
  assert.equal(render('{{t | short}}', { t: '가'.repeat(50) }), `${'가'.repeat(39)}…`)
})

test('기본 카탈로그는 빠진 문구가 없다', () => {
  assert.deepEqual(validateCatalog(catalog), [])
  assert.deepEqual(validateCatalog({ x: { channels: ['mail'], ko: { mail: { subject: '{{a | zzz}}' } } } }), [
    'x/ko/mail.subject: 모르는 필터 zzz',
    'x/en/mail: 문구가 없다',
  ])
})
