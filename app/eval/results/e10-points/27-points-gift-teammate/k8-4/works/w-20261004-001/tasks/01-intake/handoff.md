---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준 금액은 상품 금액 − 쿠폰 − 사용 포인트(배송비 제외)로 한다"
    why: "고객센터 값 237P와 일치하는 기준, 사람이 선택"
    by: human
  - what: "적립 포인트는 1%를 소수점 버림한다"
    why: "반올림이면 238P로 고객센터 값과 달라짐, 사람이 선택"
    by: human
assumptions:
  - "다른 주문(O-1077, O-1107)도 같은 기준이 맞다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "버림 규칙이 기존 테스트나 다른 호출처의 기대와 다를 수 있음"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 포인트는 배송비 제외, 사용 포인트 차감 후 금액의 1%를 소수점 버림한다 (사람)"
---
## 요약
O-1042 적립 포인트가 268P로 나오는 버그의 의도를 정리했다. 기대 규칙은 배송비 제외, 사용 포인트 차감, 버림이며 237P가 된다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnPoints`가 `percentOf(order.amounts.total, POINT_RATE_PERCENT)` 사용. `percentOf`는 `src/money.js`에서 반올림.
- `src/orders/order.js`: `createOrder`가 `points.earned`를 저장한다. `amounts`에 goods, coupon, shipping, pointsUsed, total이 있음.
- O-1042: 상품 28,270 − 쿠폰 3,000 + 배송비 3,000 − 사용 1,500 = 26,770 → 268P. 기대는 23,770 → 237P.
- 테스트: `npm test`(node --test).
