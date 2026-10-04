---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장만 반영(1번 반영, 2번 사소는 반영 안 함)"
    why: "사람이 추천안을 고름"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(gift-points.js)은 옛 기준이라 선물 주문의 적립과 회수가 어긋날 수 있음(비목표)"
  - "옛 기준으로 저장된 주문은 저장된 적립이 새 회수 합보다 작을 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(권장 1, 사소 1) 중 권장만 반영해 환불 회수 합 테스트를 정리했다(커밋 9b80d64). 모든 완료조건 통과, `npm test` 28개 통과, O-1042 237P. pr.md 작성.
새 지식: docs/knowledge/points/earn-basis.md — 맞는 기존 항목이 없고, 적립 기준과 환불 회수 기준(사람이 알려 줌), 선물하기 미적용을 남김
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`, `src/orders/refund.js:36`, `src/money.js`의 `floorPercentOf`.
- 테스트: test/order.test.js, test/refund.test.js. `src/format/`, `test/receipt.test.js` 변경 없음.
- 선물하기 적립은 지식 항목의 `아직 규칙을 따르지 않는 곳`에 기록함.
