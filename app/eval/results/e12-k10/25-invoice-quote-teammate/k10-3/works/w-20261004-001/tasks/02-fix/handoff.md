---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서(`quote.js`)와 반품 전표(`credit-note.js`)는 이번에 고치지 않고 청구서 `computeTotals`만 고친다"
    why: "intent의 목표와 완료조건이 청구서에 한정되고, 두 파일은 `computeTotals`를 쓰지 않고 자체 계산을 가진다. 사람이 범위를 넓히라고 하지 않음"
    by: ai
assumptions:
  - "면세 줄과 영세율은 지금처럼 부가세 0 (intake의 가정 그대로)"
rejected:
  - "`percentOf` 반올림이 원인: `computeTotals`는 `percentOf`를 쓰지 않음. 할인 계산용이라 비목표"
open_questions: []
intent_deviation: null
risks:
  - "`src/invoice/quote.js:42`(할인 전 금액에 부가세를 매기고 할인분을 뺌, percentOf 반올림)와 `src/invoice/credit-note.js` `creditTotals`(공급가액 합계 Math.round)는 여전히 반올림 방식이다. 같은 회계팀 규칙을 적용할지 사람이 정해야 한다"
  - "이미 발행된 청구서는 저장된 totals를 쓰므로 바뀌지 않지만, 초안 청구서는 다시 계산하면 값이 달라진다"
recommended_next: null
knowledge_candidates:
  - "부가세는 과세 품목 줄마다 할인 후 금액의 10%를 원 단위 버림으로 계산해 합산한다. 합계에서 다시 반올림하지 않는다 (회계팀 규칙) (사람)"
  - "정하지 않음: 견적서·반품 전표에 줄별 버림 규칙을 적용할지 — 사람이 정함, 지금 코드(`quote.js`, `credit-note.js`)는 합계 반올림 방식"
---
## 요약
`computeTotals`의 부가세를 줄별 버림 합산으로 고쳤다. INV-2031은 부가세 2,641원, 합계 29,079원이다. 재현 테스트 2개를 추가했고 `npm test` 50개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 vat 계산 (`Math.floor` 줄별 합산).
- 테스트: `test/total.test.js` 끝의 2개. 수정 전 2개 실패, 수정 후 통과.
- 견적서(`quote.js:42`)와 반품 전표(`credit-note.js` `creditTotals`)는 미수정, 범위 판단 필요.
- 발행된 청구서 `totals`와 `src/format/`은 건드리지 않았다.
