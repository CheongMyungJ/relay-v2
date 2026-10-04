---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림으로 계산해 합한다. 합계에서 다시 반올림하지 않는다"
    why: "사람이 알려 준 회계팀 규정. INV-2031 회계팀 합계 29,079원과 일치"
    by: human
  - what: "할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 매긴다"
    why: "사람이 알려 준 회계팀 규정"
    by: human
assumptions:
  - "할인 금액 자체의 반올림(비율 할인, 반품 줄 할인 안분)은 규정에 말이 없어 현재 방식 그대로 둔다. 예시 기대값은 이를 전제로 계산했다"
  - "Q-0457.json은 taxType이 없어 createQuote의 기본값(과세)으로 계산한 값을 기대값으로 썼다"
  - "면세 줄과 영세율 문서의 부가세는 0으로 이전과 같다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "INV-2047은 발행된 청구서라 저장된 부가세 5,801원(합계 기준 반올림)을 그대로 쓴다. 새 규정의 반품 전표와 원 청구서 부가세가 몇 원 어긋날 수 있다"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세 규정: 품목 줄마다 원 단위 버림으로 계산한 부가세의 합을 청구서 부가세로 쓰고 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 버그의 의도를 정리했다. 회계팀 규정(줄별 버림, 할인 후 부가세)을 청구서·견적·반품 전표 모두에 적용하는 것으로 범위를 넓혔다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: `vat`가 과세 합계에 `Math.round`를 쓴다. 가설일 뿐 확인하지 않았다.
- INV-2031 줄별 net: 5368, 6335, 3255, 8375, 3105 (합 26,438). 줄별 버림 부가세 536+633+325+837+310 = 2,641.
- `src/invoice/invoice.js:35`와 `:42`가 `computeTotals`를 쓴다. 발행된 청구서는 저장된 `totals`를 쓴다(README).
- `src/invoice/quote.js:42` `quoteTotals`: 할인 전 금액 부가세에서 할인분 부가세를 빼는 방식. `src/invoice/credit-note.js:90` `creditTotals`: 합계 기준 `Math.round`. 둘 다 가설일 뿐 확인하지 않았다.
- 현재 값 → 규정 값: Q-0457 vat 3589 → 3587, total 56280 → 56278. CN-0112(INV-2047) vat 1744 → 1742, total 19182 → 19180. CN 줄 net: 9236, 6127, 2075.
- 테스트: `npm test` (`node --test`), 관련 파일 `test/total.test.js`.
