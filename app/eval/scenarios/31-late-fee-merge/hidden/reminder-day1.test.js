// 연체 안내 문자는 하루 늦은 날에도 유예 없이 계산한 연체료를 보여 준다(빨리 반납하게 하려는 CS팀 결정)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reminderText } from '../src/notify/reminder.js'

const r = {
  id: 'R-1',
  memberId: 'M-1',
  toolId: 'T-100',
  toolName: '전동 드릴',
  dailyRate: 8000,
  deposit: 50000,
  startDate: '2026-09-01',
  dueDate: '2026-09-04',
  returnedOn: null,
  extensions: 0,
  charges: [],
}

test('하루 늦은 날의 안내 문자', () => {
  assert.equal(reminderText(r, '2026-09-04'), null)
  assert.equal(
    reminderText(r, '2026-09-05'),
    '[동네공구] 김하나님, 전동 드릴 반납이 1일 늦었습니다. 현재 연체료 4,000원. 빨리 반납해 주세요.',
  )
})
