---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 사소 2건을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "Math.max(0, …) 하한은 의도에 없는 방어 동작이고 테스트가 없다"
  - "src/gift/gift-points.js 반올림은 범위 밖. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과(`npm test` 22개, O-1077/R-0311 = 132P). 바뀐 테스트 파일은 추가만 있어 약화 아님.
고친 지식: docs/knowledge/points/earn-rule.md — 부분 환불 회수 규칙 추가, src/orders/refund.js를 '아직 규칙을 따르지 않는 곳'에서 지우고 이력 추가
## 다음 task가 알아야 할 것
- 변경 코드: `src/orders/refund.js:29-38`, 테스트 `test/refund.test.js` 하단 2개
- 산출물: verification.md, pr.md
- earn-rule.md는 앞 Work 내용을 살려 같은 경로에 썼다(머지 시 이 파일이 남음)
