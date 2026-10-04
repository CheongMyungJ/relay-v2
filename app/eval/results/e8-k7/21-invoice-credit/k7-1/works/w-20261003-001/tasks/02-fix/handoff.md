---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 부가세는 할인 후 공급가액(net) 기준 Math.floor로 계산한다"
    why: "intent 완료조건과 회계팀 규정"
    by: ai
  - what: "money.js의 percentOf는 바꾸지 않는다"
    why: "할인과 반품 전표에서도 쓰며, 반품 전표 계산 방식은 비목표"
    by: ai
assumptions: []
rejected:
  - "percentOf의 Math.round가 원인: computeTotals는 percentOf를 쓰지 않음"
open_questions: []
intent_deviation: null
risks:
  - "발행 후 저장된 totals는 이전 방식 값이라 새로 계산한 값과 다를 수 있다(비목표)"
  - "기존 테스트의 부가세 기대값은 줄별 버림과 결과가 같아 변경 없이 통과했다"
recommended_next: null
knowledge_candidates:
  - "부가세 계산 위치는 src/invoice/total.js의 computeTotals이며, percentOf(src/money.js)는 할인과 반품 전표용이다"
---
## 요약
부가세를 과세 줄마다 원 단위 버림으로 계산해 합산하도록 고쳤다. INV-2031은 부가세 2,641원, 합계 29,079원이다. 테스트 2건을 추가했고 `npm test` 48건이 통과한다.
## 다음 task가 알아야 할 것
- 변경: `src/invoice/total.js`의 `vat` 계산, 테스트는 `test/total.test.js` 끝부분
- 기존 테스트 변경 없음, 기준 커밋에서도 전부 통과
- 테스트 명령: `npm test`
