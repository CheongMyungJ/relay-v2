---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립 기준을 팀 지식의 일반 주문 적립 규칙에 맞춘다"
    why: "docs/knowledge/points/earn-basis.md 규칙이 이번 경우를 덮고, 요청도 일반 주문과 같아야 한다고 함"
    by: ai
assumptions:
  - "G-0213의 기대값 218P는 팀 지식 규칙으로 계산한 값이다 (상품 24,860 − 쿠폰 2,000 − 포인트 1,000 = 21,860의 1%)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "refund.js의 부분 환불 회수는 적립 기준과 달라 선물 주문 환불 시 차이가 날 수 있으나 이번 범위에서 뺌"
recommended_next: null
knowledge_candidates:
  - "아직 규칙을 따르지 않음: src/orders/refund.js — 부분 환불 회수가 반올림·차감 전 금액 기준, 이번 Work 범위가 아님 (사람)"
---
## 요약
선물하기 주문 적립 포인트를 일반 주문과 같은 기준으로 맞추는 버그 수정 intent 초안을 썼다. 질문 없이 팀 지식 규칙을 따랐다.
## 다음 task가 알아야 할 것
- 참고 지식: `docs/knowledge/points/earn-basis.md` (이 파일의 "아직 규칙을 따르지 않는 곳"에 gift-points.js가 있으나 이번 요청이 그걸 고치는 일이므로 규칙대로 고친다)
- `src/gift/gift-points.js`: 현재 `percentOf(order.amounts.total, ...)` 사용 (반올림, 총 결제액 기준)
- 테스트: `npm test` (`node --test`), 관련 `test/gift.test.js`
- 예시: `examples/G-0213.json`, 기대 218P
