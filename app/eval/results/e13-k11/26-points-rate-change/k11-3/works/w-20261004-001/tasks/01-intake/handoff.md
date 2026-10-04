---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 = (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 소수점 버림"
    why: "고객센터 안내 237P와 정확히 일치(23,770원 × 1% = 237.7 → 237). 사람이 확인함"
    by: human
  - what: "선물하기 적립과 환불 회수도 같은 규칙으로 맞춘다"
    why: "사람이 범위에 포함하라고 답함"
    by: human
assumptions:
  - "환불 회수(refund.js의 percentOf(refundGoods))도 버림 규칙을 적용한다는 해석"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수를 버림으로 바꾸면 적립분보다 회수가 달라질 수 있어 fix에서 확인 필요"
  - "기존 테스트(order 500, gift 300 등)가 옛 규칙 값에 의존하는지 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 제외한 (상품 금액 − 쿠폰 − 사용 포인트)의 1%를 소수점 버림한다. 고객센터 적립 안내 기준 (사람)"
---
## 요약
적립 계산을 고객센터 안내 규칙(배송비 제외, 버림)으로 맞추는 intent 초안을 썼다. 일반 주문, 선물하기, 환불 회수가 범위다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`: `percentOf(order.amounts.total, ...)`. total은 배송비 포함, `percentOf`는 반올림(`src/money.js`)
- `src/gift/gift-points.js:6`: 같은 식. `src/orders/refund.js:34`: `percentOf(refundGoods, ...)`
- O-1042: goods 28,270 − 쿠폰 3,000 = 25,270, 배송비 3,000, 포인트 1,500 → total 26,770(268P). 기대값은 23,770 → 237P
- 시험: `npm test`
