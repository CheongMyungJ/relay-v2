// 알림 문구. 종류마다 언어(ko, en)별로 메일 제목, 메일 본문, 문자 본문을 둔다.
import { kstDate } from '../shared/time.js'

const won = (n) => `${n.toLocaleString('ko-KR')}원`

const STATUS_KO = { placed: '접수', paid: '결제 완료', shipped: '배송 중', delivered: '배송 완료', cancelled: '취소' }

const TEMPLATES = {
  'order.placed': {
    ko: {
      subject: (d) => `주문 ${d.number}이 접수됐어요`,
      body: (d) => `주문 ${d.number}이 접수됐어요.\n결제할 금액: ${won(d.total)}\n상품 ${d.itemCount}개`,
      sms: (d) => `[샵] 주문 ${d.number} 접수, ${won(d.total)}`,
    },
    en: {
      subject: (d) => `Order ${d.number} received`,
      body: (d) => `We received your order ${d.number}.\nAmount due: ${won(d.total)}\nItems: ${d.itemCount}`,
      sms: (d) => `[Shop] Order ${d.number} received, ${won(d.total)}`,
    },
  },
  'order.shipped': {
    ko: {
      subject: (d) => `주문 ${d.number} 상품이 출발했어요`,
      body: (d) => `주문 ${d.number} 상품이 출발했어요.\n택배 ${d.carrier} ${d.trackingNo ?? ''}`.trim(),
      sms: (d) => `[샵] 주문 ${d.number} 출발 (${d.carrier} ${d.trackingNo ?? '-'})`,
    },
    en: {
      subject: (d) => `Your order ${d.number} has shipped`,
      body: (d) => `Your order ${d.number} has shipped.\nCarrier ${d.carrier} ${d.trackingNo ?? ''}`.trim(),
      sms: (d) => `[Shop] Order ${d.number} shipped (${d.carrier} ${d.trackingNo ?? '-'})`,
    },
  },
  'order.cancelled': {
    ko: {
      subject: (d) => `주문 ${d.number}이 취소됐어요`,
      body: (d) => `주문 ${d.number}이 취소됐어요.`,
      sms: (d) => `[샵] 주문 ${d.number} 취소`,
    },
    en: {
      subject: (d) => `Order ${d.number} cancelled`,
      body: (d) => `Your order ${d.number} has been cancelled.`,
      sms: (d) => `[Shop] Order ${d.number} cancelled`,
    },
  },
  'invoice.issued': {
    ko: {
      subject: (d) => `송장 ${d.invoiceNumber}`,
      body: (d) => `송장 ${d.invoiceNumber}을 보내 드려요.\n금액: ${won(d.total)}\n납부 기한: ${kstDate(d.dueAt)}`,
      sms: (d) => `[샵] 송장 ${d.invoiceNumber} ${won(d.total)}, 기한 ${kstDate(d.dueAt)}`,
    },
    en: {
      subject: (d) => `Invoice ${d.invoiceNumber}`,
      body: (d) => `Here is your invoice ${d.invoiceNumber}.\nAmount: ${won(d.total)}\nDue: ${kstDate(d.dueAt)}`,
      sms: (d) => `[Shop] Invoice ${d.invoiceNumber} ${won(d.total)}, due ${kstDate(d.dueAt)}`,
    },
  },
  'invoice.reminder': {
    ko: {
      subject: (d) => `송장 ${d.invoiceNumber} 납부 안내`,
      body: (d) => `송장 ${d.invoiceNumber}의 납부 기한이 ${d.step}일 지났어요.\n남은 금액: ${won(d.balance)}`,
      sms: (d) => `[샵] 송장 ${d.invoiceNumber} 미납 ${won(d.balance)}`,
    },
    en: {
      subject: (d) => `Invoice ${d.invoiceNumber} is overdue`,
      body: (d) => `Invoice ${d.invoiceNumber} is ${d.step} days overdue.\nBalance: ${won(d.balance)}`,
      sms: (d) => `[Shop] Invoice ${d.invoiceNumber} overdue ${won(d.balance)}`,
    },
  },
  promo: {
    ko: {
      subject: (d) => d.title,
      body: (d) => `${d.text}\n수신 거부: 설정 > 알림`,
      sms: (d) => `(광고)[샵] ${d.title} 수신거부 080-000-0000`,
    },
    en: {
      subject: (d) => d.title,
      body: (d) => `${d.text}\nUnsubscribe: Settings > Notifications`,
      sms: (d) => `(AD)[Shop] ${d.title} STOP 080-000-0000`,
    },
  },
}

export const TYPES = Object.keys(TEMPLATES)

export function statusLabel(status) {
  return STATUS_KO[status] ?? status
}

/** 문구를 만든다. 없는 언어는 ko로 */
export function render(type, locale, data) {
  const t = TEMPLATES[type]
  if (!t) throw new Error(`알림 문구가 없습니다: ${type}`)
  const lang = t[locale] ?? t.ko
  return { subject: lang.subject(data), body: lang.body(data), sms: lang.sms(data) }
}
