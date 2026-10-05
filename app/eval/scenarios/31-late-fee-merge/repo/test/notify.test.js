import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { reminderText, sendReminders } from '../src/notify/reminder.js'
import { clearOutbox, outbox } from '../src/notify/sms.js'
import { render } from '../src/notify/templates.js'
import { resetStore } from '../src/rentals/store.js'
import { rental } from './helpers.js'

beforeEach(() => {
  resetStore([])
  clearOutbox()
})

test('문자 틀', () => {
  assert.equal(
    render('due-soon', { name: '김하나', tool: '전동 드릴', due: '2026-09-04' }),
    '[동네공구] 김하나님, 전동 드릴 반납일이 내일(2026-09-04)입니다.',
  )
})

test('늦지 않았으면 연체 안내가 없다', () => {
  assert.equal(reminderText(rental(), '2026-09-04'), null)
})

test('연체 안내 문자', () => {
  assert.equal(
    reminderText(rental(), '2026-09-07'),
    '[동네공구] 김하나님, 전동 드릴 반납이 3일 늦었습니다. 현재 연체료 12,000원. 빨리 반납해 주세요.',
  )
})

test('아침 문자: 내일 반납과 연체', () => {
  resetStore([
    rental({ id: 'R-1', dueDate: '2026-09-11' }),
    rental({ id: 'R-2', memberId: 'M-2', dueDate: '2026-09-05' }),
    rental({ id: 'R-3', memberId: 'M-3', dueDate: '2026-09-05', returnedOn: '2026-09-05' }),
    rental({ id: 'R-4', memberId: 'M-4', dueDate: '2026-09-20' }),
  ])
  assert.equal(sendReminders('2026-09-10'), 2)
  assert.deepEqual(
    outbox.map((m) => m.to),
    ['010-1111-2222', '010-3333-4444'],
  )
  assert.match(outbox[1].text, /5일 늦었습니다. 현재 연체료 20,000원/)
})
