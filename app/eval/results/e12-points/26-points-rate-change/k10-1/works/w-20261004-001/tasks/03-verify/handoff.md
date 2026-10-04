---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 3건(모두 사소)을 모두 반영"
    why: "사람이 모두 반영을 골랐다"
    by: human
assumptions:
  - "부분 환불 회수의 상한은 건별로 저장된 points.earned 이하로 충분하다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "나눠서 한 여러 환불의 회수 합계가 적립값을 넘는지는 막지 않음"
  - "intent의 '상품 25,270원'은 실제 28,270원이며 결과 237P는 같음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건을 모두 반영했고(테스트 4건 추가, 환불 회수 상한), 완료조건 8개는 모두 통과다. `npm test` 28건 통과, O-1042는 237P다.
새 지식: docs/knowledge/points/earn-rule.md — 맞는 기존 항목이 없는 까닭: 팀 지식 항목이 아직 없음
## 다음 task가 알아야 할 것
- 반영 커밋 1678c3b, `src/orders/refund.js:34`(Math.min 상한)
- 테스트: `test/earn.test.js` 8건, `npm test`
- `src/format/`은 변경 없음
