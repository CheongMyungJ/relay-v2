---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 할인 후 줄 금액 기준, 줄마다 원 단위 버림, 그 합을 부가세로 쓴다. 합계에서 다시 반올림하지 않는다"
    why: "사람이 회계팀 규정으로 알려 줌. INV-2031 기대 합계 29,079원"
    by: human
  - what: "비목표는 제안안대로 한다(발행분 재계산 안 함, src/format/ 불변, 세율·할인 규칙 불변)"
    why: "사람이 제안안을 선택함"
    by: human
assumptions:
  - "INV-2031의 품목은 모두 과세이고 할인이 없다고 가정했다. 줄별 버림 부가세 536+633+325+837+310=2,641, 합계 26,438+2,641=29,079로 회계팀 값과 맞는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행된 청구서가 저장된 합계를 쓰는지, 코드 어디서 다시 계산하는지는 확인하지 않았다. fix에서 확인해야 한다"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세 규정: 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 품목 줄마다 원 단위 버림으로 계산해 그 합을 쓴다. 합계에서 다시 반올림하지 않는다 (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 그대로 쓴다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 버그의 의도를 정리했다. 부가세를 줄별 원 단위 버림으로 계산하는 회계팀 규정을 기대 동작으로 정했다.
## 다음 task가 알아야 할 것
- 코드는 `src/invoice/total.js:28`, `computeTotals`. 지금은 과세 공급가액 합에 `Math.round`를 한 번 적용한다. 원인으로 확정한 것은 아니다.
- 테스트는 `npm test`(`node --test`), 관련 파일은 `test/total.test.js`.
- 예시 데이터는 `examples/INV-2031.json`. 현재 29,082원, 기대 29,079원.
- 부가세 줄별 계산: 536, 633, 325, 837, 310.
