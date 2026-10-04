---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않음"
    why: "사람이 '반영하지 않음'을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 lineVat을 추가했을 수 있음, 머지 대기. 머지 뒤 creditTotals를 lineVat으로 합칠 수 있음"
  - "새 테스트가 examples를 cwd 기준 상대 경로로 읽음(사소, 미반영)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이며 사람이 반영하지 않기로 했다. 재현 절차 재실행 결과 CN-0112 환불 합계 19,180원, `npm test` 50개 통과, 완료조건 6개 모두 통과. 테스트 파일 변경은 추가뿐이라 약화 아님.
남긴 지식: 없음 (반품 전표 포함 부가세 규칙은 앞 Work의 docs/knowledge/invoice-vat-per-line-floor.md가 이미 덮고, 새로 알게 된 규칙이 없음)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`의 vat 계산
- 테스트: `test/credit-note.test.js` 끝 2개
- 산출물: tasks/03-verify/verification.md, pr.md
