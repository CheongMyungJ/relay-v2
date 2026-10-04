---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 사소 2건을 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택. 동작과 완료조건에 영향 없음"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서 src/invoice/total.js는 이 브랜치에서 아직 Math.round다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 비목표라 건드리지 않음"
  - "returnedDiscount의 금액 할인 Math.round는 회계팀 규칙 미확인. CN-0112에서는 맞음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건뿐이고 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과했다. `npm test` 48개 통과, CN-0112 환불 합계 19,180원을 직접 확인했다. 테스트 파일은 추가만 있어 약화 아님.
고친 지식: docs/knowledge/billing/vat-calculation.md — 반품 전표(`creditTotals`) 부가세가 청구서와 같은 줄별 버림 합산으로 정해졌고, CN-0112 기준값(부가세 1,742원, 합계 19,180원)을 추가했다. 기준 브랜치에 없던 파일이라 앞 내용을 살려 같은 경로에 새로 썼고 미정 절은 지웠다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js:90-93`
- 테스트: `test/credit-note.test.js` 끝의 2개. `npm test`
- 산출물: `tasks/03-verify/verification.md`, `pr.md`
