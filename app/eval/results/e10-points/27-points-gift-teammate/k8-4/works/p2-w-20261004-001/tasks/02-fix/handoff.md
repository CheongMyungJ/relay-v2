---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints를 earnPoints에 위임한다"
    why: "docs/knowledge/points/order-earn-points.md 규칙을 그대로 따르고 percentOf는 건드리지 않기 위함"
    by: ai
assumptions: []
rejected:
  - "percentOf를 버림으로 변경: 환불 회수 포인트까지 바뀜"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 pointsRecovered는 여전히 percentOf 반올림이라 선물 환불과 적립 규칙이 어긋날 수 있다 (비목표)"
recommended_next: null
knowledge_candidates:
  - "선물 적립(giftPoints)은 earnPoints에 위임해 일반 주문과 같은 규칙(상품−쿠폰−사용 포인트의 1% 버림, 배송비 제외)을 쓴다. G-0213은 218P"
---
## 요약
선물 적립이 total 기준 반올림이어서 249P였다. earnPoints에 위임해 218P로 맞췄고 재현 테스트를 추가했다. npm test 24개 통과.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: earnPoints 위임
- `test/gift.test.js`: 일반 주문과 선물 적립 동일 테스트
- 환불 `src/orders/refund.js`는 변경하지 않음
