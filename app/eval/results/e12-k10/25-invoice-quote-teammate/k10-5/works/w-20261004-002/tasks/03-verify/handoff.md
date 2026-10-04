---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, 면세 테스트 기대값을 고정값 567로)을 반영함"
    why: "사람이 모두 반영을 고름"
    by: human
assumptions:
  - "회계팀 기대값은 줄별 버림 규칙대로 19,180원이라고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "percentOfFloor는 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 때 충돌 가능"
  - "청구서(computeTotals)와 견적서(quoteTotals)는 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "부분 반품 시 할인 반올림 규칙은 정해지지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)을 반영해 커밋(ea2ccc1)했고, 완료조건 8개가 모두 통과다. 재실행한 `npm test`는 50개 통과다. CN-0112는 vat 1,742, 합계 19,180원이다.
고친 지식: docs/knowledge/billing/vat-rounding.md — 앞 Work의 항목을 살려 CN-0112 예와 반품 전표 저장 totals 규칙을 더하고, 부분 반품 할인 반올림을 "아직 정하지 않은 것"에 적음
## 다음 task가 알아야 할 것
- 변경: `src/invoice/credit-note.js` `creditTotals`, `src/money.js` `percentOfFloor`
- 테스트: `test/credit-note.test.js` 끝의 2개
- 산출물: tasks/03-verify/verification.md, pr.md
