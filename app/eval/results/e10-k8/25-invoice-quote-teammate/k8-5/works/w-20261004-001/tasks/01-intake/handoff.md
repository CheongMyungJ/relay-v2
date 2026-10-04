---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 할인된 줄 금액에 줄마다 원 단위 버림으로 계산해 합산한다"
    why: "사람이 알려 준 회계팀 규정. INV-2031이 29,079원이 됨을 직접 계산해 확인함"
    by: human
  - what: "새로 계산하는 청구서부터 적용하고 발행분은 재계산하지 않는다"
    why: "요청의 제약과 사람의 답"
    by: human
assumptions:
  - "면세 줄과 영세율 청구서는 기존대로 부가세 0 (회계 규정에 별도 언급 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행된 청구서의 합계를 어디에 저장하는지 확인하지 않음. 저장값이 아니라 매번 재계산하는 경로가 있으면 발행분이 바뀔 수 있음"
recommended_next: null
knowledge_candidates:
  - "회계팀 규정: 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 품목 줄마다 원 단위 버림으로 계산한 합이며 합계에서 다시 반올림하지 않는다 (사람)"
---
## 요약
INV-2031 합계가 회계팀(29,079원)보다 3원 크다. 회계팀 규정에 맞춰 부가세 계산을 바꾸는 bugfix 의도를 정리했다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:27`: 지금은 과세 공급가액 전체 합에 10%를 곱해 `Math.round` 한다. INV-2031은 26,438 x 10% = 2,643.8 -> 2,644, 합계 29,082.
- 회계팀 방식 검산: 줄별 부가세 536+633+325+837+310 = 2,641, 합계 29,079 (전 품목 과세).
- 참고용 가설(확인 안 됨): 합계 단위 반올림이 원인으로 보임.
- 테스트는 `npm test`(`node --test`), 관련 파일 `test/total.test.js`. 부가세율은 `src/config.js`의 `VAT_RATE_PERCENT`.
- 발행분 보존 여부 확인 필요: `src/invoice/invoice.js`, `src/export/` 등에서 `computeTotals` 호출처.
