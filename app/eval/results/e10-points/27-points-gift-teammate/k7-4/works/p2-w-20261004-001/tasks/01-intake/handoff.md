---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립도 일반 주문과 같은 규칙(상품 금액 - 쿠폰 - 사용 포인트의 1%, 배송비 제외, 버림)을 따르게 한다"
    why: "요청이 고객센터 계산 218P와 일반 주문과의 차이를 지적했고, 팀 지식 earn-points-rule이 이 규칙을 정함"
    by: ai
  - what: "부분 환불 회수는 비목표로 둔다"
    why: "요청 범위가 선물하기 적립이다. 회수 확인은 별도 판단 대상"
    by: ai
assumptions:
  - "G-0213의 218P는 상품 24,860 - 쿠폰 2,000 - 포인트 1,000 = 21,860원의 1%를 버림한 값으로 계산해 맞춤"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불의 포인트 회수가 같은 식을 따로 쓰고 있어 적립 규칙이 바뀌면 회수가 더 클 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물하기 주문 G-0213의 적립 예정 포인트를 218P로 맞추는 버그 수정 intent 초안을 썼다. 메시지 카드, 받는 사람 정보, 영수증 글자는 비목표다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js:6`: 지금은 `percentOf(order.amounts.total, ...)`로 결제 금액 기준이다. 참고용 관찰이며 원인 확정은 아니다.
- `src/points/earn.js`: 일반 주문 적립 식(`earnPoints`)이 이미 규칙대로 구현되어 있다.
- 참고 지식: `docs/knowledge/earn-points-rule.md`, `docs/knowledge/earn-rule-duplicated-copies.md`(부분 환불 `src/orders/refund.js`도 같은 식 복사본)
- 테스트 명령: `npm test` (`node --test`)
