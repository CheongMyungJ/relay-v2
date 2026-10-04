---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 1(README 한 줄 보충, 사소)을 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택"
    by: human
  - what: "order.test.js 기대값 500→1000 변경은 약화 아님으로 판정한다"
    why: "적립률 2% 반영이고 단언 대상이 같다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립이 1%(배송비 포함·반올림)로 남아 일반 주문과 비율이 다름"
  - "환불 회수 1%는 정산팀 결정 대기"
  - "앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기. refund.js 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)은 사람이 반영하지 않았다. 완료조건 7개 모두 통과: O-1107 적립 486, `npm test` 22개 통과, O-1077/R-0311 회수는 기준 커밋과 같은 131.
고친 지식: docs/knowledge/points/earn-rule.md — 적립률 1%→2%, 환불 회수·선물하기 1% 상수 분리 기록(앞 Work 내용은 모두 유지)
## 다음 task가 알아야 할 것
- `src/config.js`: `POINT_RATE_PERCENT=2`, `REFUND_RECOVER_RATE_PERCENT=1`, `GIFT_POINT_RATE_PERCENT=1`
- `src/points/earn.js:6`: `earnPoints`는 `src/orders/order.js:35`에서만 호출
- 재현: O-1107 → `points.earned` 486
