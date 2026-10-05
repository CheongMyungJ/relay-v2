// 서비스 설정
export const config = {
  serviceName: '밥상정기',
  reminderDaysBefore: 3,
  deliveryCutoffHour: 18,
  firstMonthCoupon: { code: 'WELCOME', rate: 0.2 },
  sms: { sender: '1588-1234', enabled: true },
}
