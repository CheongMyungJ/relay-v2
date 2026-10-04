---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(percentOf 미사용, 사소)을 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected:
  - "percentOf 제거: 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "옛 규칙으로 저장된 주문을 부분 환불하면 회수량이 저장된 적립과 어긋날 수 있음(소급 비목표)"
  - "src/money.js의 percentOf가 쓰이지 않은 채 남음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이고 반영하지 않았다. 완료조건 6개 모두 통과(`npm test` 26개 통과, O-1042 237P). 바뀐 테스트 파일은 새 `test/earn-rule.test.js`뿐이며 약화 아님. `pr.md`를 썼다.
새 지식: docs/knowledge/points/earn-rule.md — 적립 규칙(배송비 제외, 버림)을 다루는 기존 항목이 없음
새 지식: docs/knowledge/points/partial-refund-recovery.md — 부분 환불 회수 방식을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 공통 식: `src/points/earn.js`의 `earnBase`, `earnOn`
- 환불 회수: `src/orders/refund.js:31`
- 테스트: `test/earn-rule.test.js`
