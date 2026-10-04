---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비를 뺀 금액이고 소수점은 버린다"
    why: "O-1042 안내 값 237P와 맞는 계산법으로 사람이 선택함"
    by: human
assumptions:
  - "사용 포인트(1,500P)는 적립 기준에서 계속 뺀다 (23,770원 = 28,270 − 3,000 − 1,500)"
  - "선물하기 적립도 같은 규칙을 따른다고 보았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 주문 유형(선물하기, 부분 환불 회수)이 earnPoints 결과에 의존하면 같이 달라질 수 있다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 뺀 금액(상품 금액 − 쿠폰 − 사용 포인트)의 적립률%를 원 단위로 버림한다 (사람)"
---
## 요약
O-1042 적립이 268P로 나오지만 안내 기준은 237P다. 사람이 배송비 제외 + 버림을 올바른 계산법으로 확정했다. 이 기준으로 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)`. total에 배송비가 포함됨
- `src/orders/order.js:16`: `total = goods - discount + shipping - pointsUsed`, `:35`에서 earnPoints 호출
- `src/money.js` `percentOf`는 `Math.round` 사용
- O-1042: 상품 28,270 − 쿠폰 3,000 + 배송비 3,000 − 포인트 1,500 = 26,770 → 현재 268P. 배송비 제외 23,770 → 버림 237P
- 확인할 곳: `src/gift/gift-points.js`, `src/orders/refund.js`, `src/points/ledger.js`, `test/order.test.js`
- 원인은 확인하지 않음(fix의 몫)
