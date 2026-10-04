---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 규정은 (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림"
    why: "사람이 고객센터 적립 규정으로 직접 알려 줌. O-1042 = 23,770원 → 237P로 일치"
    by: human
assumptions:
  - "선물하기 주문의 적립도 같은 규정을 따른다고 본다 (확인 안 함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "환불 시 적립 포인트 회수가 저장된 적립액을 기준으로 하므로, 계산식 변경 후 회수액이 달라질 수 있음"
recommended_next: null
knowledge_candidates:
  - "적립 규정: 상품 금액에서 쿠폰 할인과 사용한 포인트를 뺀 금액의 1%, 배송비에는 적립하지 않고, 1P 미만은 버린다(반올림 안 함) (사람)"
---
## 요약
O-1042 적립이 268P로 나오는 문제의 의도를 정리했다. 규정상 237P가 맞다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`: `percentOf(order.amounts.total, ...)` 사용. total은 배송비 포함, 사용 포인트 차감, 반올림(`src/money.js` percentOf).
- `src/orders/order.js:11-16`: amounts = goods, coupon, shipping, pointsUsed, total. 적립 기준은 goods − coupon − pointsUsed.
- `src/gift/gift-points.js`, `src/orders/refund.js`, `src/points/ledger.js`도 적립/회수에서 같은 값을 쓰는지 확인할 것.
- 테스트: `npm test` (현재 20개 통과).
