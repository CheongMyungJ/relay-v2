---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림으로 계산해 합산하고, 합계에서 재반올림하지 않는다"
    why: "회계팀 기준을 사람이 직접 알려 줌 (INV-2031 회계팀 합계 29,079원)"
    by: human
assumptions:
  - "INV-2031의 모든 줄이 과세이고 세율 10%라고 가정: 줄별 버림 부가세 536+633+325+837+310=2,641, 공급가액 26,438 + 2,641 = 29,079로 회계팀 합계와 일치"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "면세 줄, zeroRated 청구서, 신용전표(credit-note) 등 다른 경로의 부가세 계산이 같은 규칙을 쓰는지 확인하지 않음"
  - "발행 후 저장된 합계가 어디서 읽히는지 확인하지 않음. 재계산 경로가 있으면 건드리지 않게 주의"
recommended_next: null
knowledge_candidates:
  - "부가세 계산 규칙: 품목 줄마다 할인 후 줄 금액에 부가세를 매겨 원 단위 버림, 그 합을 부가세로 쓰며 합계에서 다시 반올림하지 않는다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 크게 나오는 버그의 의도를 정리했다. 회계팀 기준은 줄별 부가세 버림 합산이고, INV-2031의 기대 합계는 29,079원이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 현재 `vat = Math.round(taxable * VAT_RATE_PERCENT / 100)`로 과세 공급가액 합계에 한 번 반올림한다. (사람이 알려 준 회계 규칙과 다름. 원인 확정은 fix에서)
- `lineAmounts`가 줄별 `net`(할인 후)과 `taxable`을 이미 제공한다.
- 테스트 명령: `npm test` (`node --test`), 관련 테스트 `test/total.test.js`
- `src/credit-note.js` 등 `src/invoice/credit-note.js`, `src/export/`가 부가세를 따로 계산하는지 fix에서 확인할 것
