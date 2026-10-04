---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄별 원 단위 버림의 합, 합계에서 재반올림하지 않음, 할인은 부가세 전에 줄별 적용"
    why: "사람이 알려 준 회계팀 규칙. INV-2031 기대 합계 29,079원"
    by: human
assumptions:
  - "INV-2031의 모든 줄이 과세이고 부가세율 10%라고 가정해 29,079원이 맞는 것을 손으로 확인함 (코드로 확인하지 않음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "면세 줄, 영세율(zeroRated), 할인 줄에서 줄별 버림 규칙이 기존 테스트와 충돌할 수 있음"
  - "다른 코드(quote, credit-note, export)가 computeTotals의 부가세에 의존할 수 있음"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 할인 후 금액에 원 단위 버림으로 계산하고 그 합을 청구서 부가세로 쓴다. 합계에서 다시 반올림하지 않는다 (회계팀 규칙) (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 그대로 쓴다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 버그의 의도 초안을 썼다. 기대 규칙은 줄별 부가세 원 단위 버림 합이며, INV-2031은 29,082원에서 29,079원이 되어야 한다.
## 다음 task가 알아야 할 것
- 코드: `src/invoice/total.js`의 `computeTotals`. 현재 vat는 과세 공급가액 합에 한 번 곱해 반올림함 (참고용 관찰, 원인 확정 아님).
- 데이터: `examples/INV-2031.json`. 줄 금액 합 26,438원, 줄별 버림 부가세 536+633+325+837+310=2,641원.
- 테스트: `npm test` (`node --test`), 관련 `test/total.test.js`, `test/invoice.test.js`.
- 건드리면 안 되는 곳: `src/format/`, 발행된 청구서 재계산.
