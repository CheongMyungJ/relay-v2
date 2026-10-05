// 시연에 쓰는 예시 구독
export const seedSubscriptions = [
  { id: 'S-101', memberId: 'M-1', planId: 'basic-m', status: 'active', startedOn: '2026-08-10', nextBillingOn: '2026-10-10', deliveryWeekday: 4, cancelledOn: null, cancelReason: null },
  { id: 'S-102', memberId: 'M-2', planId: 'family-y', status: 'active', startedOn: '2026-03-02', nextBillingOn: '2027-03-02', deliveryWeekday: 2, cancelledOn: null, cancelReason: null },
  { id: 'S-103', memberId: 'M-4', planId: 'basic-m', status: 'cancelled', startedOn: '2026-05-20', nextBillingOn: '2026-09-20', deliveryWeekday: 3, cancelledOn: '2026-09-01', cancelReason: '가격' },
]
