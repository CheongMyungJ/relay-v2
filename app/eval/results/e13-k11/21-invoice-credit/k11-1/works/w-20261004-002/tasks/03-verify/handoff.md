---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, CN-0112 테스트가 합계를 19,180원으로 직접 단언)을 모두 반영"
    why: "사람이 '모두 반영'을 골랐다"
    by: human
assumptions:
  - "회계팀 기대 금액은 줄별 버림 합산(19,180원)이라고 가정했다. 요청에 정확한 금액은 없다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 lineVat을 이미 고쳤을 수 있음, 머지 대기. 머지 시 src/invoice/total.js의 lineVat이 충돌할 수 있어 하나로 합쳐야 한다"
  - "computeTotals는 아직 Math.round 합계 방식이다(비목표). 이 브랜치에서는 청구서와 반품 전표의 부가세 방식이 다르다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이었고 사람이 반영을 골라 테스트 단언을 고쳤다(커밋 4eb746a). 재현 절차를 다시 실행하니 CN-0112는 vat 1,742, 합계 19,180원이다. `npm test`는 48개 통과. 완료조건 5개 모두 통과, 테스트 파일 변경은 약화 아님.
남긴 지식: 없음 (이 Work에서 사람이 새로 알려 준 규칙이 없고, 기존 항목 vat-per-line-floor.md와 issued-invoice-stored-totals.md가 이미 덮는다)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 `lineVat`, `src/invoice/credit-note.js`의 `creditTotals`
- 테스트: `test/credit-note.test.js` 끝의 2개
- 앞 Work 머지 후 `lineVat` 중복·충돌 확인
