---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 사소 2건을 모두 반영한다(주석에서 문서 경로 제거, 테스트 이름 명확화)"
    why: "사람이 모두 반영을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: total.js:26과 quote.js:42는 아직 합계 기준 반올림이나 비목표라 건드리지 않음"
  - "금액 할인의 부분 반품(returnedDiscount 반올림)은 CN-0112 외에 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 차단·권장 지적은 없고 사소 2건을 반영해 커밋(e4485a4)했다. 완료조건 6개 모두 통과, 테스트 파일 변경은 약화 아님. `npm test` 50개 통과, CN-0112 재현 시 합계 19,180원.
남긴 지식: 없음 (이 Work의 규칙은 기존 vat-per-line-floor.md가 이미 반품 전표까지 덮고, 새로 알게 된 규칙·사실이 없음)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`
- 테스트: `test/credit-note.test.js` 끝의 두 테스트
- 재현: INV-2047/CN-0112로 `createCreditNote(...).totals`
