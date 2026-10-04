---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(영세율 반품 전표 테스트 없음, 사소)은 반영하지 않는다"
    why: "사람이 반영하지 않음을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 total.js에 lineVat/sumLineVat을 고쳤을 수 있음, 머지 대기. 머지 뒤 credit-note.js의 같은 이름 함수는 공유 코드로 바꿔야 할 수 있음"
  - "영세율 반품 전표 테스트 없음 (지적 1, 미반영)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)은 반영하지 않았다. 완료조건 6개 모두 통과: 재현 절차 결과 부가세 1,742원, 합계 19,180원이고 npm test는 50개 통과했다. 바뀐 테스트 파일은 추가만 있어 약화가 아니다.
남긴 지식: 없음 (기존 vat-per-line-floor 규칙이 이미 반품 전표를 덮고, 새 규칙이나 사실이 없다)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `lineVat`/`sumLineVat`/`creditTotals`
- 테스트: `test/credit-note.test.js` 끝의 2개
- 재현은 INV-2047을 createInvoice 후 issueInvoice로 발행해야 한다
