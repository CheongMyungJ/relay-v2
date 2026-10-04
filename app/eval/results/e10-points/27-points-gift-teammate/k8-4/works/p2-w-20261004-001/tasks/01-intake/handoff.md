---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물 적립 기대 동작을 일반 주문 적립 규칙과 같게 한다"
    why: "요청이 '같은 상품을 일반 주문으로 샀을 때와 다르다'를 문제로 삼았고, 팀 지식에 일반 주문 규칙이 있다"
    by: ai
assumptions:
  - "선물 주문도 배송비를 적립 기준에서 제외한다 (G-0213 기대값 218P는 이 가정에 따른 계산)"
  - "팀 지식의 선물 적립 비목표 표기는 이번 요청이 선물 수정을 직접 요청하므로 해당하지 않는다고 보았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물 주문에 일반 주문과 다른 적립 정책이 의도된 것이라면 기대값이 달라진다"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물 적립을 일반 주문 규칙(상품−쿠폰−사용 포인트의 1% 버림, 배송비 제외)에 맞추는 의도를 정리했다. G-0213 기대값은 218P다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js:5`: 현재 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`로 total(배송비 포함) 기준 반올림.
- 일반 주문 적립은 `src/points/earn.js`의 `earnPoints`, 주문 생성 `src/orders/order.js:35`.
- `percentOf`(src/money.js)는 환불도 쓰므로 직접 바꾸지 말 것: docs/knowledge/points/percent-of-rounding.md
- 규칙: docs/knowledge/points/order-earn-points.md
- 테스트: `npm test` (node --test)
