---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, 면세·영세율 테스트 추가)은 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서 쪽(src/invoice/total.js:26)은 비목표라 합계 기준 Math.round 그대로임. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "면세 줄 혼합·영세율 전표 부가세는 테스트로 직접 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건(미반영). 완료조건 6개 모두 통과, `npm test` 48개 통과. CN-0112는 1,742원/19,180원으로 재현 확인.
고친 지식: docs/knowledge/billing/vat-per-line-floor.md — 반품 전표 코드가 규칙대로 고쳐져 "아직 규칙을 따르지 않는 곳" 절을 지우고 CN-0112 예와 이력을 더함(앞 Work 내용은 모두 살려 같은 경로에 씀)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`. 테스트: `test/credit-note.test.js` 끝 2개.
- 청구서 `src/invoice/total.js:26`은 여전히 합계 기준 반올림(비목표).
