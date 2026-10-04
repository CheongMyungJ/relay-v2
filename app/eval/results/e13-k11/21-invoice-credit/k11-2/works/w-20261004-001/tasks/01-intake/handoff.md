---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 할인된 과세 줄 금액에 줄마다 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다"
    why: "사람이 회계팀 규정으로 알려 줌. INV-2031 기대 합계 29,079원 (줄별 536+633+325+837+310=2,641원)"
    by: human
  - what: "반품 전표(`src/invoice/credit-note.js:90`, CN-0112)도 이번 범위에 넣고 같은 줄별 버림 규정을 적용한다"
    why: "사람이 합계 기준 반올림 버그로 보고 범위에 넣어 달라고 요청함"
    by: human
assumptions:
  - "면세 줄과 영세율 청구서의 기존 처리는 그대로 유지한다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "CN-0112의 기대 합계 금액은 사람에게서 받지 못했다. 규정(줄별 버림)으로 계산한 값을 fix에서 테스트 기대값으로 삼아야 한다."
  - "`computeTotals`는 `src/invoice/invoice.js`, `src/export/monthly.js`, `ledger.js`, `invoices-csv.js`가 쓴다. 발행 전 계산에만 적용되고 발행본은 저장된 합계를 쓰는지 fix에서 확인해야 한다."
recommended_next: null
knowledge_candidates:
  - "부가세 규정: 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 품목 줄마다 원 단위 버림으로 계산해 합산한다. 합계에서 다시 반올림하지 않는다 (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 그대로 쓴다. `src/format/` 출력은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다 (사람)"
---
## 요약
청구서와 반품 전표 합계가 회계팀보다 크게 나오는 버그의 intent 초안을 썼다(반품 전표는 사람 요청으로 범위에 추가). 기대 규칙은 줄별 부가세 원 단위 버림이다. INV-2031은 29,079원이어야 한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js`의 `computeTotals`: 지금은 과세 공급가액 합에 `Math.round(taxable * 10 / 100)`을 한 번 적용한다. 원인 확인은 fix의 일이다.
- 테스트: `npm test` (`node --test`), 관련 파일은 `test/total.test.js`, `test/invoice.test.js`.
- 같은 모양의 코드: `src/invoice/credit-note.js:90` (`creditTotals`), 이번 범위에 포함. 줄 금액은 `creditLineAmounts`, 할인 안분은 `returnedDiscount`. 저장된 `note.totals`가 있으면 재계산하지 않는다(`creditNoteTotals`). CN-0112는 INV-2047의 반품.
- 기대값 검산: 공급가액 26,438원, 줄별 부가세 합 2,641원, 합계 29,079원.
