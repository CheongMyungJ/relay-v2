---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 줄마다 할인 후 금액 기준 원 단위 버림, 합계에서 재반올림 없음"
    why: "사람이 알려 준 회계팀 규칙. INV-2031 회계팀 합계 29,079원"
    by: human
  - what: "비목표는 요청에 적힌 것만(발행분 재계산 금지, src/format/ 불변)"
    why: "사람이 '요청 내용만'을 선택"
    by: human
assumptions:
  - "면세 줄과 영세율 청구서는 기존대로 부가세 0 처리"
  - "발행된 청구서가 저장된 합계를 쓰는 경로는 이미 있다고 보고 바꾸지 않는 것만 조건으로 둠"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행된 청구서가 저장 합계를 쓰는 경로를 아직 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 할인 적용 후 금액에 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다 (회계팀 규칙) (사람)"
  - "이미 발행된 청구서는 재계산하지 않고 저장된 합계를 그대로 쓴다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 문제의 의도 초안을 썼다. 기대 동작은 회계팀 규칙(줄별 부가세 버림 후 합산)이다.
## 다음 task가 알아야 할 것
- 코드: `src/invoice/total.js` `computeTotals`에서 부가세는 현재 과세 공급가액 합에 `Math.round`로 계산한다.
- INV-2031: 공급가액 26,438원이다. 현재 부가세 2,644원, 합계 29,082원이다. 줄별 버림이면 536+633+325+837+310=2,641원, 합계 29,079원이다.
- 테스트 명령: `npm test` (`node --test`), 관련 테스트는 `test/total.test.js`.
- 팀 지식(`docs/knowledge/`)에 해당 항목 없음.
