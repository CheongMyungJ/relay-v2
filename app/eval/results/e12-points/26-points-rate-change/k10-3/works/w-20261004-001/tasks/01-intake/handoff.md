---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "적립 기준은 상품 − 쿠폰 − 사용 포인트(배송비 제외), 1% 원 단위 버림"
    why: "O-1042 고객센터 값 237P와 일치하는 유일한 조합"
    by: human
  - what: "선물 적립과 환불 회수 포인트도 같은 기준으로 맞춘다"
    why: "적립과 회수가 어긋나지 않게"
    by: human
assumptions:
  - "고객센터 규칙은 O-1042 한 건의 값에서 역산했다. 다른 주문으로는 확인하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이미 저장된 과거 주문의 적립 값은 소급하지 않으므로 환불 시 회수 포인트와 어긋날 수 있다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 뺀 금액(상품 − 쿠폰 − 사용 포인트)의 1%를 원 단위로 버림한다 (사람)"
---
## 요약
적립이 많게 나오는 문제의 의도를 정리했다. 기준 금액에서 배송비를 빼고 버림하도록 하며, 선물·환불도 함께 맞춘다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`: `percentOf(order.amounts.total, ...)`. total에는 배송비가 들어 있고 `percentOf`는 반올림(`src/money.js`).
- 같은 계산이 `src/gift/gift-points.js:6`, `src/orders/refund.js:34`에도 있다(참고용 가설, 원인 확인은 fix에서).
- O-1042: goods 28,270, coupon 3,000, shipping 3,000, 사용 1,500, total 26,770 → 현재 268P. 배송비 제외 23,770 → 237P.
- `src/orders/order.js:35`에서 주문 생성 시 `points.earned`를 저장한다.
- 테스트: `npm test` (node --test)
