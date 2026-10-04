---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 포인트 = (상품 금액 - 쿠폰 할인 - 사용한 포인트)의 1%, 배송비 제외, 1P 미만 버림"
    why: "사람이 규칙을 직접 알려 줬다. 고객센터 계산으로 O-1042는 237P"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34 부분 환불 회수(percentOf(refundGoods))는 같은 적립률을 쓴다. 이번 범위에 넣지 않았다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트 = (상품 금액 - 쿠폰 할인 - 사용한 포인트)의 1%, 배송비 제외, 1P 미만 버림(반올림 아님). 고객센터 계산 기준 O-1042는 237P (사람)"
---
## 요약
O-1042 적립 예정 268P를 고객센터 계산 237P에 맞추는 bugfix 의도 초안을 썼다. 저장된 적립값, 영수증 글자, 선물하기 적립은 비목표다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)`. total은 배송비 포함, 포인트 사용액 차감 후(`src/orders/order.js:17`). 반올림은 `src/money.js` `percentOf`(Math.round).
- O-1042: 상품 28,270 - 쿠폰 3,000 + 배송비 3,000 - 포인트 1,500 = 26,770 -> 268P. 사람이 정한 규칙: 배송비 제외, 버림 -> 23,770 x 1% = 237P. 구현은 배송비를 뺀 금액(goods - coupon - pointsUsed)과 Math.floor가 필요하다.
- `src/gift/gift-points.js`는 같은 식을 복사해 쓰지만 수정 금지다.
- `src/orders/order.js:35`에서 저장하는 `points.earned`를 영수증(`src/format/receipt.js:16`)이 그대로 출력한다.
- 테스트: `npm test` (현재 20개 통과). 적립 전용 테스트는 없다.
