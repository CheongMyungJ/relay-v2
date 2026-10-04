---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서와 반품 전표에도 청구서와 같은 줄별 버림 부가세 규칙을 적용한다"
    why: "사람 추가 지시(범위 확대)"
    by: human
  - what: "이미 저장된 견적서·반품 전표 totals도 다시 계산하지 않는다"
    why: "청구서와 같은 저장 합계 원칙(credit-note.js 주석)과 사람 지시의 '발행된 저장 합계 그대로'를 같이 적용"
    by: ai
  - what: "반품 전표와 원 청구서 부가세의 맞물림은 확인 결과만 알리고 보정 규칙은 만들지 않는다"
    why: "사람이 '확인해서 알려 달라'고만 했음"
    by: ai
assumptions:
  - "반품 전표 줄 부가세도 (돌려받는 줄 공급가액 × 10%) 줄별 버림이다"
  - "견적서의 영세율은 청구서와 같이 부가세 0"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표를 줄별로 버리면 원 청구서 부가세(INV-2047은 옛 규칙으로 저장, 5,801원)와 전부 반품해도 1원 단위로 어긋날 수 있다. 사람이 판단할 일일 수 있음"
  - "견적서 금액이 새 규칙으로 바뀌면 같은 품목으로 만든 청구서와 일치하는지 확인 필요"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 과세 품목 줄마다 (할인 후 줄 금액 × 10%)를 원 단위 버림, 그 합이 부가세, 합계에서 재반올림 없음 (사람)"
  - "발행된 청구서의 저장 합계와 src/format/ 출력은 바뀌면 안 된다 (사람)"
  - "정하지 않음: 반품 전표 부가세와 원 청구서 부가세의 맞물림 — 이번 Work에서 확인 결과를 알리고 사람이 판단, 지금 코드는 합계에 한 번 반올림 (사람)"
---
## 요약
되감기 지시에 따라 범위를 견적서·반품 전표로 넓힌 의도 초안을 썼다. 청구서 규칙과 INV-2031 기대값은 그대로다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 합계 과세분에 `Math.round` 한 번 (이전 시도에서 줄별 버림으로 고침, 코드는 되돌려짐)
- `src/invoice/quote.js` `quoteTotals`: `percentOf(gross 합) - percentOf(discount 합)` 방식
- `src/invoice/credit-note.js` `creditTotals`: 과세 공급가액 합계에 `Math.round`. `returnedDiscount`는 할인 계산이라 건드리지 않음
- `src/export/ledger.js:33`은 `creditNoteTotals`(저장값 우선)를 씀
- 테스트: `npm test`(node --test), `test/total.test.js`, `test/quote.test.js`, `test/credit-note.test.js`
- 예시: `examples/Q-0457.json`, `examples/CN-0112.json`(INV-2047, 저장 vat 5,801)
