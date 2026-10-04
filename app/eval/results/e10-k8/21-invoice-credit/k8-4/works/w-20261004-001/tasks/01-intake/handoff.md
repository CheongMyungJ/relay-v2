---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "부가세는 과세 줄마다 할인 적용 후 금액에 원 단위 버림으로 계산하고 그 합을 쓴다. 합계에서 다시 반올림하지 않는다"
    why: "사람이 회계팀 규칙으로 알려 줌"
    by: human
  - what: "INV-2031 기대 합계는 29,079원(부가세 2,641원)"
    why: "사람이 회계팀 값으로 알려 줌. 줄별 버림 계산과 일치"
    by: human
  - what: "발행된 청구서 재계산과 src/format/ 변경은 비목표"
    why: "요청 원문대로, 사람이 확인"
    by: human
assumptions:
  - "면세 줄은 부가세가 없고 영세율 청구서는 부가세 0인 기존 동작을 유지한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 코드(크레딧노트, export)가 computeTotals의 부가세에 의존하면 값이 바뀔 수 있음"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 할인 적용 후 금액에 원 단위 버림으로 계산하고 그 합을 청구서 부가세로 쓴다. 합계에서 다시 반올림하지 않는다 (사람)"
---
## 요약
부가세를 줄별 버림 계산 후 합산하도록 고치는 버그 수정 의도를 확정했다. 회계팀 규칙을 받아 미결 질문은 없다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 현재 `Math.round(taxable * VAT_RATE_PERCENT / 100)`로 과세 합계에 한 번만 계산한다. `VAT_RATE_PERCENT`는 10(`src/config.js:12`).
- INV-2031 줄별 순액 5368/6335/3255/8375/3105, 줄별 부가세 버림 536/633/325/837/310, 합 2,641, 합계 29,079.
- `lineAmounts`가 줄별 net과 taxable을 이미 준다. 영세율은 `invoice.zeroRated`.
- 크레딧노트(`src/invoice/credit-note.js`)와 export가 부가세를 쓰는지 확인 필요.
- 시험 명령: `npm test`
