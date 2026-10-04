---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "INV-2031 기대 합계를 29,079원으로, 부가세는 줄별 원 단위 버림 합으로 정함"
    why: "사람이 회계 규정과 회계팀 계산값을 알려 줌"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "면세 줄과 영세율(zeroRated) 청구서에서 줄별 부가세 처리는 규정에 명시되지 않음. 현재 동작을 유지하는 것으로 봄"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 품목 줄마다 원 단위 버림으로 계산해 그 합을 쓰고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (사람)"
---
## 요약
회계 규정(줄별 버림 부가세, 줄별 할인 후 부가세)과 기대 합계 29,079원을 intent에 반영했다. 열린 질문은 없다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트는 `test/`
- 합계 계산: `src/invoice/total.js`의 `computeTotals`, 합산은 `src/money.js`의 `sumWon`, 부가세율 `src/config.js`의 `VAT_RATE_PERCENT`
- 재현 데이터: `examples/INV-2031.json` (현재 29,082원, 기대 29,079원)
