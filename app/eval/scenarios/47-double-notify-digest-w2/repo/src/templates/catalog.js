// 알림 문구. 이벤트 종류마다 보낼 채널과 언어별 문구가 있다.
// required: 수신 거부와 관계없이 보내야 하는 알림(보안, 결제)

export const catalog = {
  'order.shipped': {
    channels: ['mail', 'push'],
    ko: {
      mail: { subject: '주문 {{orderNo}} 상품이 출발했어요', body: '{{carrier}} 운송장 {{trackingNo}}로 배송이 시작되었습니다.' },
      push: { title: '배송 시작', body: '주문 {{orderNo}} 상품이 출발했어요' },
    },
    en: {
      mail: { subject: 'Your order {{orderNo}} has shipped', body: 'Tracking number {{trackingNo}} ({{carrier}}).' },
      push: { title: 'Shipped', body: 'Order {{orderNo}} is on its way' },
    },
  },
  'order.delivered': {
    channels: ['push'],
    ko: { push: { title: '배송 완료', body: '주문 {{orderNo}} 상품이 도착했어요' } },
    en: { push: { title: 'Delivered', body: 'Order {{orderNo}} has arrived' } },
  },
  'payment.failed': {
    channels: ['mail', 'push'],
    required: true,
    ko: {
      mail: { subject: '결제가 실패했어요', body: '{{amount | won}} 결제가 실패했습니다. 결제 수단을 확인해 주세요.' },
      push: { title: '결제 실패', body: '{{amount | won}} 결제가 실패했어요' },
    },
    en: {
      mail: { subject: 'Payment failed', body: 'Your payment of {{amount | usd}} failed.' },
      push: { title: 'Payment failed', body: '{{amount | usd}} payment failed' },
    },
  },
  'password.reset': {
    channels: ['mail'],
    required: true,
    ko: { mail: { subject: '비밀번호 재설정', body: '아래 링크로 비밀번호를 바꿔 주세요: {{link}}' } },
    en: { mail: { subject: 'Reset your password', body: 'Use this link to reset your password: {{link}}' } },
  },
  'order.cancelled': {
    channels: ['mail', 'push'],
    ko: {
      mail: { subject: '주문 {{orderNo}}이 취소되었어요', body: '{{amount | won}}은 결제 수단으로 3~5영업일 안에 돌려드립니다.' },
      push: { title: '주문 취소', body: '주문 {{orderNo}}이 취소되었어요' },
    },
    en: {
      mail: { subject: 'Order {{orderNo}} was cancelled', body: '{{amount | usd}} will be refunded within 3-5 business days.' },
      push: { title: 'Order cancelled', body: 'Order {{orderNo}} was cancelled' },
    },
  },
  'refund.completed': {
    channels: ['mail'],
    ko: { mail: { subject: '환불이 끝났어요', body: '{{amount | won}}을 {{refundedAt | date}}에 돌려드렸습니다.' } },
    en: { mail: { subject: 'Your refund is complete', body: '{{amount | usd}} was refunded on {{refundedAt | date}}.' } },
  },
  'account.email-changed': {
    channels: ['mail', 'push'],
    required: true,
    ko: {
      mail: { subject: '메일 주소가 바뀌었어요', body: '계정 메일 주소가 {{newEmail | mask}}로 바뀌었습니다. 직접 바꾸지 않았다면 고객센터로 알려 주세요.' },
      push: { title: '보안 알림', body: '계정 메일 주소가 바뀌었어요' },
    },
    en: {
      mail: { subject: 'Your email address changed', body: 'Your account email is now {{newEmail | mask}}. Contact support if this was not you.' },
      push: { title: 'Security alert', body: 'Your account email changed' },
    },
  },
  'account.welcome': {
    channels: ['mail'],
    ko: { mail: { subject: '{{name}}님, 환영합니다', body: '가입해 주셔서 고맙습니다.' } },
    en: { mail: { subject: 'Welcome, {{name}}', body: 'Thanks for signing up.' } },
  },
}
