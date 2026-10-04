---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js:6)은 배송비 포함 반올림이라 일반 주문과 규정이 다르다 (사람이 범위에서 뺌)"
  - "부분 환불 회수(src/orders/refund.js:34)는 상품 금액 기준 반올림이라 새 적립값과 어긋날 수 있다 (사람이 범위에서 뺌)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었고 모든 완료조건이 통과했다. 재현 절차는 237P, `npm test`는 24개 통과다. 바뀐 테스트 파일은 새로 추가한 `test/earn.test.js`뿐이라 약화가 아니다.
새 지식: docs/knowledge/points/earn-rule.md — 적립 규정과 아직 따르지 않는 곳(선물하기, 환불)을 다룬 기존 항목이 없음
새 지식: docs/knowledge/points/stored-earned-points.md — 저장된 `points.earned`를 다시 계산하지 않는 규칙을 다룬 기존 항목이 없음
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`: `Math.floor((total - shipping) * rate / 100)`
- 선물하기·환불 회수는 규정과 다르며 `docs/knowledge/points/earn-rule.md`에 기록함
