---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림으로 계산하고 합산한다"
    why: "사람이 회계 규정으로 알려 줌. 회계팀 INV-2031 합계 29,079원"
    by: human
assumptions:
  - "면세 줄과 영세율 청구서의 부가세는 0원 그대로 둔다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "저장된 합계를 쓰는 발행 청구서 경로와 새로 계산하는 경로를 fix에서 구분해야 한다"
recommended_next: null
knowledge_candidates:
  - "회계 규정: 부가세는 품목 줄마다 원 단위 버림으로 계산하고 그 합을 청구서 부가세로 쓴다. 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다. (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 그대로 쓴다. (사람)"
---
## 요약
청구서 부가세를 회계 규정(줄마다 버림)대로 계산하도록 고치는 버그 수정 의도를 정리했다.
## 다음 task가 알아야 할 것
- 계산 코드: `src/invoice/total.js` `computeTotals`. 지금은 과세 공급가액 합에 `Math.round(taxable * 10 / 100)`을 한 번 적용하는 것으로 보인다 (참고용, 원인 확정 아님).
- INV-2031 손계산: 공급가액 26,438원. 줄 부가세 버림 536+633+325+837+310 = 2,641 → 합계 29,079원. 현재는 2,644 → 29,082원.
- 테스트: `npm test` (`node --test`), 관련 `test/total.test.js`, `test/invoice.test.js`.
- `src/quote.js` 등 `computeTotals`를 쓰는 다른 곳(견적 `src/invoice/quote.js`, 반품 `credit-note.js`, `src/export/`)의 영향은 fix에서 확인할 것.
