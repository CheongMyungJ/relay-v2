---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1건(사소, CN-0112 테스트 합계를 리터럴 19180으로)을 모두 반영"
    why: "사람이 '모두 반영'을 골랐다"
    by: human
assumptions:
  - "회계팀 기대값은 줄별 버림 규칙과 같다고 보았다(요청에 회계팀 금액 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 total.js를 고쳤을 수 있음, 머지 대기. 머지 뒤 lineVat과 vatOfRows 중복 정리 검토"
  - "기준 브랜치의 청구서 total.js는 합계 반올림 방식일 수 있어 청구서와 반품 전표 부가세가 어긋날 수 있음(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건을 반영(커밋 67a034b)하고 완료조건 5개를 모두 통과로 판정했다. 재현 절차 실행 결과 CN-0112는 부가세 1,742원/합계 19,180원이고 `npm test`는 49개 통과다. 남긴 지식: docs/knowledge/credit-note-totals-reference-cn-0112.md
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `lineVat`, `creditTotals`
- 테스트 변경: `test/credit-note.test.js` 추가 3개, 기존 테스트 약화 없음
- 산출물: `verification.md`, `pr.md`
