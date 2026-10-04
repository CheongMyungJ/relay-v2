---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(부분 환불 회수식)은 이 Work에서 코드로 반영하지 않고 intake로 돌아가 intent에 환불 회수를 포함한다"
    why: "회수가 적립(237P)보다 많아질 수 있어 정산이 안 맞는다. 비목표라 intent 수정이 먼저. 조건: 회수가 저장된 적립액을 넘지 않고 새 규정과 맞게, 영수증 글자(src/format)는 그대로"
    by: human
  - what: "리뷰 지적 2(사소)는 반영하지 않음"
    why: "사람이 고르지 않음. 불필요한 변경"
    by: human
assumptions: []
rejected:
  - "지적 1을 비목표 안에서 바로 고치기: 환불 회수 규칙 변경은 비목표"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수가 적립보다 최대 1P 많을 수 있음 (src/orders/refund.js:34)"
  - "이미 저장된 옛 주문의 적립액은 옛 값 그대로"
recommended_next:
  node: intake
  reason: "사람 요청: 부분 환불 회수가 적립액을 넘지 않고 새 적립 규정과 맞도록 intent에 환불 회수를 포함한다. 영수증 글자(src/format)는 유지"
knowledge_candidates: []
---
## 요약
리뷰 지적 2건. 완료조건 6개는 모두 통과(237P, npm test 25 pass). 부분 환불 회수식이 새 규정과 달라 회수가 적립보다 1P 많을 수 있어 사람이 intake 복귀를 정했다.
새 지식: docs/knowledge/points/earn-rule.md — 적립 규정을 다루는 기존 항목이 없음
새 지식: docs/knowledge/points/refund-recovery-mismatch.md — 환불 회수 불일치를 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 회수식: `src/orders/refund.js:34` `percentOf(refundGoods, 1%)`. 전체 취소(`cancelOrder`)는 저장값 237P 회수로 정상.
- O-1042 부분 환불 회수: TE-0410 1개 89P, SN-1135 1개 35P. 환불 상품 금액 최대 23,770원 → 최대 238P.
- 조건: `src/format` 영수증 글자 변경 금지.
