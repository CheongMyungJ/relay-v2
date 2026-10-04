---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 1P 미만 버림, 배송비 제외"
    why: "사람이 적립 규정으로 알려 줌. O-1042는 237P가 맞음"
    by: human
  - what: "환불 시 포인트 회수와 선물하기 적립도 이번 범위에 포함"
    why: "사람이 포함하라고 답함"
    by: human
  - what: "이미 적립된 값은 재계산하지 않고, 영수증 글자(src/format/)는 바꾸지 않음"
    why: "사람이 비목표로 지정"
    by: human
assumptions:
  - "환불 회수도 환불 상품 금액 기준에 같은 버림 규칙을 적용하는 것으로 봄. 쿠폰·사용 포인트 안분 방식은 fix에서 정해야 함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "환불 회수 포인트에서 쿠폰·사용 포인트를 어떻게 안분할지 규정이 없음"
recommended_next: null
knowledge_candidates:
  - "적립 규정: 상품 금액에서 쿠폰 할인과 사용한 포인트를 뺀 금액의 1%, 1P 미만은 버림(반올림 아님), 배송비는 적립 제외 (사람)"
  - "이미 적립된 값은 재계산하지 않는다 (사람)"
---
## 요약
적립 예정 포인트가 배송비를 포함한 결제 금액을 반올림해 계산되어 많게 나오는 버그의 의도를 정리했다. 규정은 사람이 알려 준 대로 적었고, 범위에는 일반 주문, 선물하기, 환불 회수를 넣었다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`, `src/gift/gift-points.js:6`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)`를 쓴다. `total`은 배송비를 포함하고 사용 포인트를 뺀 값이다.
- `src/orders/refund.js:34`: 회수 포인트도 `percentOf`로 반올림한다.
- `src/money.js` `percentOf`는 `Math.round`를 쓴다. 다른 곳에서도 쓰므로 바꿀 때 영향 범위를 확인한다.
- `order.amounts`: goods, coupon, shipping, pointsUsed, total. O-1042는 28,270 − 3,000 + 3,000 − 1,500 = 26,770원.
- 테스트는 `npm test` (`node --test`). 적립 전용 테스트 파일은 없다.
