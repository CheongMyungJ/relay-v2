---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1번(테스트 추가)과 2번(저장된 earned에서 남은 적립을 빼도록 수정)을 반영"
    why: "사람이 반영할 지적을 골랐고, 저장된 points.earned는 재계산하지 않는다는 규칙을 말함"
    by: human
  - what: "alreadyRefunded 연속 환불 테스트는 pointsRecovered를 고정하지 않고 refundAmount만 단언"
    why: "이전 회수분이 중복될 수 있어 잘못된 값을 고정하지 않으려 함"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded가 있는 연속 부분 환불은 이전 회수분을 중복 회수할 수 있음 (입력에 이전 회수 포인트 없음)"
  - "earnPoints(저장 적립)는 배송비 포함 기준이라 배송비 있는 주문은 earned와 earnFromAmounts 기준이 다를 수 있음"
  - "앞 Work(w-20261004-001)에서 earnFromAmounts를 이미 만들었을 수 있음, 머지 대기. src/points/earn.js 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 회수 포인트가 환불 전 적립을 재계산하는 문제를 고쳤다. 이제 저장된 `points.earned`에서 남은 상품의 적립을 뺀다. R-0311은 132P, 환불 금액은 그대로이고 `npm test` 23 pass다. 완료조건 6개 모두 통과, 테스트 파일은 추가만 있어 약화 아님.
고친 지식: docs/knowledge/points/stored-earned-not-recalculated.md — 부분 환불 회수 규칙(저장된 earned − 남은 상품 적립) 추가
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund: `order.points.earned - remainingEarn`
- 재현: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P
- 테스트: `npm test` (23 pass)
- 남은 위험: 연속 부분 환불 시 이전 회수분 중복 가능
