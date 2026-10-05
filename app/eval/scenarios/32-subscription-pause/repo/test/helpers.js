// 시험용 구독 기록
export function sub(over = {}) {
  return {
    id: 'S-1',
    memberId: 'M-1',
    planId: 'basic-m',
    status: 'active',
    startedOn: '2026-09-10',
    nextBillingOn: '2026-10-10',
    deliveryWeekday: 4,
    cancelledOn: null,
    cancelReason: null,
    ...over,
  }
}
