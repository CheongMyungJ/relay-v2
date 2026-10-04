---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 사소 2건을 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택했다"
    by: human
assumptions:
  - "고객센터 기준은 O-1042 한 건으로 추정한 배송비 제외 + 버림이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js)은 배송비 포함 반올림 그대로다"
  - "부분 환불 회수 포인트(src/orders/refund.js:34)가 새 적립 기준과 다를 수 있다"
  - "고객센터 기준은 한 건으로 추정했다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과, 테스트 파일은 신규 추가만이라 약화 아님이다. pr.md를 썼다.
새 지식: docs/knowledge/points/earn-basis.md — 맞는 기존 항목이 없다
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/earn.test.js` (`npm test` 25개 통과)
- 지식 파일에 gift-points.js(사람이 범위에서 뺌)와 refund.js:34를 "아직 규칙을 따르지 않는 곳"으로 적었다
