---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비 제외, 소수점 버림으로 한다 (O-1042 = 237P)"
    why: "237P가 되는 계산을 사람이 추천안으로 확인함"
    by: human
assumptions:
  - "배송비 제외는 (상품 금액 − 쿠폰 − 사용 포인트) 기준이라고 가정함. 사용 포인트를 빼는지는 O-1042 하나로는 237P가 이 경우만 맞아서 정함"
  - "선물하기와 환불 회수도 같은 기준이어야 한다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "O-1042 한 건으로 기준을 추정함. 다른 예시 주문의 안내 값은 확인하지 못함"
  - "반올림이 아니라 버림이 맞는지는 O-1042 한 건만 근거임"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 제외한 금액의 적립률을 소수점 버림으로 계산한다 (사람)"
---
## 요약
O-1042 적립이 268P로 나오는 문제의 intent 초안을 썼다. 기대 동작은 배송비 제외, 소수점 버림으로 237P다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)`로 계산함. 참고용 관찰이며 원인 확정이 아니다.
- `src/money.js` `percentOf`는 Math.round를 쓴다.
- `src/orders/order.js`: 주문 생성 시 `points.earned`를 저장하고 영수증과 환불이 이 값을 쓴다. `src/gift/gift-points.js`는 별도 계산이다.
- O-1042 계산: 상품 28,270, 쿠폰 3,000, 배송비 3,000, 사용 1,500, total 26,770이다.
- 테스트: `npm test` (node --test)
