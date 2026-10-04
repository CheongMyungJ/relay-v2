---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비 제외 금액(상품 − 쿠폰 − 사용 포인트)의 1%, 소수점 버림"
    why: "사람이 고름. O-1042에서 237P와 맞는 유일한 후보"
    by: human
  - what: "선물하기 적립은 범위 밖, 환불 회수는 어긋나면 같이 맞춤"
    why: "사람의 답: 선물은 요청 범위 밖이면 제외, 환불은 확인 후 어긋나면 맞춤"
    by: human
assumptions:
  - "고객센터 안내 문서는 확인하지 못했고 237P에 맞춰 계산식을 정했다"
rejected:
  - "배송비 제외, 소수점 반올림: 같은 기준액이면 238P라 안내의 237P와 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "환불 회수(percentOf, 반올림)와 새 적립(버림)의 반올림 방식이 다르면 환불 때 회수가 적립보다 1P 많거나 적을 수 있다"
  - "배송비 제외 기준이 무료배송 주문에서 기존과 달라지는지 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "포인트 적립은 배송비를 제외한 금액(상품 − 쿠폰 − 사용 포인트)의 1%, 소수점 버림이다 (사람)"
---
## 요약
O-1042 적립 예정 포인트가 268P로 나오지만 안내대로는 237P다. 적립 기준을 배송비 제외, 소수점 버림으로 정하고, 환불 회수 정합성 확인을 완료조건에 넣었다. 선물 적립은 제외했다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js:6` `percentOf(order.amounts.total, POINT_RATE_PERCENT)`. `amounts.total`에는 배송비가 들어 있고(`src/orders/order.js:15`) `percentOf`는 반올림이다(`src/money.js`).
- O-1042 값: 상품 28,270, 쿠폰 3,000, 배송비 3,000, 사용 포인트 1,500, total 26,770 → 현재 268P.
- 환불 회수: `src/orders/refund.js:34` `percentOf(refundGoods, POINT_RATE_PERCENT)`는 상품 금액 기준이라 적립과 기준이 다르다.
- 같은 식이 `src/gift/gift-points.js:6`에도 있으나 범위 밖이다.
- 테스트: `npm test` (node --test).
