---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 품목 줄마다 원 단위 버림으로 계산해 합산하고 합계에서 다시 반올림하지 않는다 (INV-2031 합계 29,079원)"
    why: "회계팀 규정을 사람이 직접 알려 줌"
    by: human
  - what: "저장된 totals와 반품 전표(CN) 금액은 이번에 바로잡지 않는다"
    why: "사람이 '새로 계산하는 합계만'을 골랐다"
    by: human
assumptions:
  - "줄별 부가세의 기준 금액은 할인 후 공급가액(net)이라고 가정했다"
  - "면세 줄은 부가세 0, 영세율 청구서는 부가세 0을 유지한다고 가정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행 후 저장된 totals는 이전 방식 값이라, 같은 청구서를 새로 계산한 값과 다를 수 있다"
  - "총합에 한 번만 반올림하는 현재 방식에 기대는 테스트나 CSV, 월별 요약 기대값이 바뀔 수 있다"
recommended_next: null
knowledge_candidates:
  - "회계팀 규정: 부가세는 품목 줄마다 원 단위 버림으로 계산해 그 합을 부가세로 쓰고, 합계에서 다시 반올림하지 않는다 (사람)"
---
## 요약
청구서 합계가 회계팀 계산보다 큰 문제를 다뤘다. 부가세를 합계에 한 번 반올림해서 생긴 차이다. 회계팀 규정(줄별 버림 합산)으로 맞추는 의도를 정리했다. 저장된 totals와 CN은 비목표다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:27`: `vat`을 과세 합계에 대해 `Math.round`로 한 번 계산한다.
- `src/money.js`의 `percentOf`도 `Math.round`를 쓴다. 반품 전표 등 다른 곳에서도 쓰는지 확인이 필요하다.
- 검증값: 줄별 부가세 536+633+325+837+310 = 2,641원, 공급가액 26,438원, 합계 29,079원.
- 기존 테스트의 부가세 기대값: `test/total.test.js`(19, 32, 52행), `test/export.test.js`(67~68행), `test/invoice.test.js`(38행).
- 테스트 명령: `npm test`
