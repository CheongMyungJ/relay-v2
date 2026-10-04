---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1·2만 반영하고 3은 반영하지 않는다"
    why: "3(부분 환불 회수의 안분)은 기존 동작이고 안분 규칙을 사람이 정해야 함"
    by: human
assumptions: []
rejected:
  - "부분 환불 회수를 적립분 비례로 바꾸기: 안분 규칙이 정해지지 않아 이번 범위에서 제외"
open_questions: []
intent_deviation: null
risks:
  - "쿠폰·사용 포인트가 있는 주문의 부분 환불 회수가 적립분보다 비례 이상으로 많다(예: 적립 237P, 1/2 환불 시 141P)"
  - "여러 번 부분 환불하면 회수 합이 적립분과 1~2P 다를 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건 중 사람이 고른 1·2(테스트 서식, 미사용 `percentOf` 삭제)만 반영했다(c95e20e). 완료조건 6개 모두 통과, `npm test` 24개 통과, O-1042는 237P.
새 지식: docs/knowledge/points/earn-points-basis.md — 적립 기준 규칙을 다룬 기존 항목이 없음
새 지식: docs/knowledge/points/partial-refund-recovery-not-proportional.md — 부분 환불 회수 주의점을 다룬 기존 항목이 없음
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`: 적립 계산 본체, `src/money.js` `percentFloor`
- `src/orders/refund.js:34`: 부분 환불 회수는 상품 금액 기준(안분 없음)
- 테스트 변경은 모두 추가만
