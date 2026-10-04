---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "INV-2031의 기대 합계는 29,079원(부가세 2,641원)으로 한다"
    why: "사람 답변: 회계팀 계산 29,079원"
    by: human
  - what: "부가세는 줄별 원 단위 버림 후 합산, 합계 재반올림 없음, 할인은 부가세 전 줄마다 적용"
    why: "사람이 알려 준 회계 규정"
    by: human
assumptions:
  - "예제 줄이 모두 과세(taxType 기본값 taxable)라서 부가세 대상 금액이 26,438원이라고 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행 후 저장된 합계를 쓰는 경로가 어디인지 intake에서는 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "회계 규정: 부가세는 품목 줄마다 원 단위 버림으로 계산해 그 합을 청구서 부가세로 쓰고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 쓴다. src/format/ 출력은 PDF 생성기가 그대로 찍으므로 바꾸면 안 된다 (사람)"
---
## 요약
청구서 부가세·합계가 회계 규정(줄별 버림)과 달라 몇 원 크게 나오는 버그의 의도를 정리했다. 기대값은 INV-2031 합계 29,079원.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 부가세를 `Math.round(taxable * 10 / 100)`로 합계에 한 번 계산함 (참고용 관찰, 원인 확인은 fix에서).
- 줄별 버림 계산 검산: 536+633+325+837+310 = 2,641 → 26,438 + 2,641 = 29,079.
- `examples/INV-2031.json` 줄에는 taxType이 없다. 정규화(`normalizeLine`)를 거치면 taxable이 기본값이다.
- 테스트: `npm test` (node --test), `test/total.test.js`.
