---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(환불 회수 포인트 버림)과 2(percentOfFloor 테스트)를 모두 반영"
    why: "사람이 모두 반영을 골랐다"
    by: human
assumptions:
  - "환불 회수 포인트는 percentOfFloor로만 맞추고 기준 금액은 상품 금액 그대로 둔다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수 포인트는 쿠폰·사용 포인트를 빼지 않은 상품 금액 기준이라 적립보다 많이 회수될 수 있다"
  - "이미 저장된 주문의 points.earned는 옛 계산 그대로다 (비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건을 모두 반영했고 완료조건 7개가 모두 통과했다. `npm test` 25개 통과, O-1042 237P, G-0213 218P.
새 지식: docs/knowledge/points/earn-base-and-rounding.md — 맞는 기존 항목이 없다 (docs/knowledge가 비어 있었음)
## 다음 task가 알아야 할 것
- 커밋: 2b3e585(환불 회수 버림), 5224be6(테스트와 지식)
- `src/orders/refund.js:34`는 `percentOfFloor`를 쓰지만 기준 금액은 상품 금액뿐
- 테스트 파일 변경은 새 test/earn.test.js뿐
