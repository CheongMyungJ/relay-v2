---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 줄마다 원 단위 버림 후 합산한다"
    why: "사람이 알려 준 회계 규정. 합계에서 다시 반올림하지 않음. INV-2031 기대 합계 29,079원"
    by: human
  - what: "합계 계산만 수정하고, 발행된 청구서와 src/format/ 출력은 건드리지 않는다"
    why: "사람이 비목표로 지정 (PDF 생성기가 format 출력을 그대로 사용)"
    by: human
assumptions:
  - "발행된 청구서의 저장된 합계를 읽는 경로가 따로 있다고 가정함 (확인 안 함)"
rejected:
  - "합계에서 부가세 절사: 사람이 아니라고 함 (합계 절사가 아님)"
open_questions: []
intent_deviation: null
risks:
  - "computeTotals 결과를 쓰는 다른 곳(export, credit-note 등)의 값이 바뀔 수 있음"
recommended_next: null
knowledge_candidates:
  - "회계 규정: 부가세는 품목 줄마다 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용한다 (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 쓴다. src/format/ 출력 형식은 PDF 생성기가 쓰므로 바뀌면 안 된다 (사람)"
---
## 요약
부가세를 줄별 원 단위 버림으로 계산하도록 고치는 의도 초안을 썼다. INV-2031 기대 합계는 29,079원이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 현재 `Math.round(taxable * VAT_RATE_PERCENT / 100)`로 합계 기준 반올림 (INV-2031: 2,644원 → 29,082원).
- 줄별 계산에는 `lineAmounts`의 `net`, `taxable`을 쓸 수 있음.
- 테스트: `npm test`, `test/total.test.js`.
- 발행된 청구서의 저장 합계 경로와 `computeTotals` 호출처는 fix에서 확인할 것.
