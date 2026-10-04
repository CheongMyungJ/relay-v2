---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 줄별 원 단위 버림 합으로 하고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용한다"
    why: "사람 답변: 회계팀 INV-2031 합계 29,079원"
    by: human
assumptions:
  - "이 규칙은 면세 줄(부가세 0)과 영세율 청구서에도 그대로 적용된다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행된 청구서와 새로 계산한 값이 달라질 수 있어, 저장 합계를 쓰는 경로가 다시 계산하지 않는지 확인 필요"
  - "원인은 아직 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 쓴다. src/format/ 출력 형식은 바꾸면 안 된다 (사람)"
---
## 요약
청구서 합계를 회계팀 방식(줄별 부가세 원 단위 버림 합)에 맞추는 버그 수정 intent를 썼다. INV-2031은 29,082원에서 29,079원이 되어야 한다.
## 다음 task가 알아야 할 것
- 계산은 `src/invoice/total.js`의 `computeTotals`. 부가세는 `Math.round(taxable * VAT_RATE_PERCENT / 100)`로 합계에 한 번 계산한다. 참고용이며 원인으로 확인한 것은 아니다.
- 손으로 확인: INV-2031 줄별 공급가액 5368, 6335, 3255, 8375, 3105 (합 26,438). 줄별 버림 부가세 536+633+325+837+310=2,641이므로 합계 29,079.
- 테스트: `npm test`(node --test), `test/total.test.js`.
