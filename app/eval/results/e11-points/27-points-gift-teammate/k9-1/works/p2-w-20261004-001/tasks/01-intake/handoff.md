---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기준 금액은 팀 지식의 적립 규칙(배송비 제외, 버림)을 선물하기에도 적용한다"
    why: "팀 지식 earn-basis.md의 규칙이고, 이번 요청이 그 미준수 코드(gift-points.js)를 고치는 일이다"
    by: ai
assumptions:
  - "G-0213 기대값 218P는 상품 24,860 − 쿠폰 2,000 − 포인트 1,000 = 21,860의 1% 버림과 일치한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "refund.js:34도 규칙을 따르지 않지만 요청 범위 밖이라 비목표로 둠"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물하기 적립 예정 포인트를 일반 주문과 같은 기준(배송비 제외, 버림)으로 맞추는 intent 초안을 썼다. G-0213은 218P가 되어야 한다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)` 한 줄로 계산한다(참고용, 원인 확정 아님).
- 참고 지식: `docs/knowledge/points/earn-basis.md` (일반 주문 `earnPoints`의 기준 참고)
- 테스트: `npm test`, 관련 파일 `test/gift.test.js`, `test/earn.test.js`
- G-0213 손계산: 24,860 − 2,000 − 1,000 = 21,860 → 218P
