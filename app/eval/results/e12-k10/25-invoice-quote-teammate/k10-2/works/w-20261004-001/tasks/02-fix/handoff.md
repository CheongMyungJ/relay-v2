---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 절사는 Math.floor로 하고 percentOf는 쓰지 않는다"
    why: "percentOf는 반올림이라 절사에 맞지 않음"
    by: ai
  - what: "견적서와 반품 전표의 부가세 계산은 이번에 바꾸지 않는다"
    why: "둘은 computeTotals를 쓰지 않고, 의도는 청구서 합계만 다룸"
    by: ai
assumptions:
  - "절사 대상은 할인 반영 후 과세 줄의 공급가액 × 10%이다"
rejected:
  - "percentOf 재사용: 반올림이라 줄별 절사에 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/quote.js의 quoteTotals와 src/invoice/credit-note.js의 creditTotals는 여전히 합계 기준 반올림이라 청구서와 부가세가 3원 정도 다를 수 있음"
  - "초안 청구서의 invoiceTotals와 발행 시 저장되는 합계가 새 방식으로 바뀜. 이미 발행된 청구서는 저장값을 그대로 씀"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 원 미만 절사 후 합산한다 (회계팀 기준) (사람)"
  - "정하지 않음: 견적서(quote.js)와 반품 전표(credit-note.js)에도 줄별 절사를 적용할지 — 아직 정해지지 않음, 지금 코드는 합계 기준 반올림"
---
## 요약
청구서 부가세를 과세 줄마다 원 미만 절사 후 합산하도록 고쳤다. INV-2031은 vat 2,641, total 29,079가 된다. 테스트 2개를 추가했고 `npm test`는 50개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js`: `lineVat`(줄별 절사)와 `computeTotals`의 vat 합산.
- `src/invoice/quote.js` `quoteTotals`와 `src/invoice/credit-note.js` `creditTotals`는 바꾸지 않았다.
- 시험 명령: `npm test`
