---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, lineVat 미사용)을 반영하지 않음"
    why: "앞 Work 머지 대기라 total.js와 충돌 위험. 머지 뒤 교체"
    by: human
assumptions:
  - "회계팀의 CN-0112 기대값은 규칙대로 계산한 1,742원/19,180원으로 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 뒤 creditTotals가 lineVat를 쓰도록 바꿀 수 있음"
  - "returnedDiscount 반올림은 그대로라 줄 공급가액이 회계팀 계산과 다를 가능성"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이고 반영하지 않았다. 완료조건 6개 모두 통과했다. 재현(19,180원)과 `npm test` 50개 통과를 직접 다시 확인했다.
고친 지식: docs/knowledge/billing/vat-per-line-floor.md — CN-0112 사례와 creditTotals의 lineVat 교체 대기 항목 추가
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals` (90-93행)
- 테스트: `test/credit-note.test.js` 마지막 두 테스트
- 산출물: verification.md, pr.md
