// 시험용 대여 기록
export function rental(over = {}) {
  return {
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
    charges: [{ kind: 'rent', amount: 24000, on: '2026-09-01' }],
    ...over,
  }
}
