---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "반품 전표(creditTotals)의 부가세도 줄별 버림으로 함께 수정"
    why: "같은 공식을 쓰는 다른 경로라 범위 확대 여부를 물었고 사람이 같이 고치라고 답함"
    by: human
  - what: "버림 계산을 `money.js`의 `floorPercentOf`로 공통화"
    why: "청구서와 반품 전표가 같은 규칙을 쓰도록"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "intent의 원하는 결과는 total.js 한정이었으나 사람 답변으로 credit-note.js까지 변경됨. 발행된 반품 전표는 저장된 totals를 쓰므로 영향 없음"
  - "export(monthly, ledger, csv)는 invoiceTotals의 vat를 그대로 쓰므로 새 발행분부터 값이 달라짐"
recommended_next: null
knowledge_candidates:
  - "반품 전표(creditTotals)도 청구서와 같이 부가세를 과세 줄마다 원 단위 버림 후 합산한다 (사람)"
---
## 요약
부가세를 과세 줄마다 할인 후 금액에 원 단위 버림으로 계산해 합산하도록 고쳤다. INV-2031은 부가세 2,641원, 합계 29,079원이 된다. 반품 전표도 같이 고쳤고 `npm test` 50개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`, `src/invoice/credit-note.js` `creditTotals`, `src/money.js` `floorPercentOf`
- 새 테스트: `test/total.test.js` 3개, `test/credit-note.test.js` 1개. 수정 전 4개 실패 확인
- `src/format/` 변경 없음. 시험 명령: `npm test`
