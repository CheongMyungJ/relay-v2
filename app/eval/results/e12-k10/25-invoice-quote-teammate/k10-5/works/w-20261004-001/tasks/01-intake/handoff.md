---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회계팀 기준 INV-2031 합계는 29,079원, 규칙은 부가세를 줄마다 원 단위 버림 후 합산, 합계에서 재반올림 없음"
    why: "사람이 답함. 줄별 부가세 536+633+325+837+310=2,641, 26,438+2,641=29,079로 검산됨"
    by: human
  - what: "반품 전표(credit-note.js)와 견적서(quote.js)도 같은 규칙으로 맞춘다"
    why: "사람이 함께 맞추라고 답함"
    by: human
assumptions:
  - "줄별 부가세의 기준 금액은 할인 후 공급가액(net)이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표는 줄 금액을 원 단위로 반올림해 비례 환급하므로, 청구서 줄 부가세와 합이 1원 어긋날 수 있다"
  - "견적서는 지금 부가세를 총액 기준으로 계산해 청구서와 다르다"
recommended_next: null
knowledge_candidates:
  - "부가세 규정: 품목 줄마다 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 문제를 부가세 줄별 버림 규칙으로 맞추는 intent 초안을 썼다. 반품 전표와 견적서도 포함하고, 발행된 청구서와 `src/format/`은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 부가세 계산 위치: `src/invoice/total.js`(computeTotals의 vat, 과세 합 기준 반올림), `src/invoice/credit-note.js:90`, `src/invoice/quote.js:40-44`(percentOf 사용, `src/money.js`).
- INV-2031: 현재 29,082원, 기대 29,079원. 줄별 부가세 536/633/325/837/310.
- 테스트: `npm test` (`test/total.test.js`, `credit-note.test.js`, `quote.test.js`).
- 발행된 청구서는 `totals`를 저장해 쓴다(README). 재계산 경로가 없는지 확인할 것.
