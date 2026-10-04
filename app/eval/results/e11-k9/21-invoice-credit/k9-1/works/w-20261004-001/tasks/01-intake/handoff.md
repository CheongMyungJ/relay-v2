---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 품목 줄마다 할인 후 금액 기준으로 원 단위 버림 계산하고 그 합을 쓴다. 합계에서 다시 반올림하지 않는다"
    why: "사람이 알려 준 회계팀 규칙. INV-2031 기대 합계 29,079원"
    by: human
  - what: "비목표는 요청 그대로 (발행분 재계산 없음, src/format/ 불변)"
    why: "사람이 요청 그대로 두기로 답함"
    by: human
assumptions:
  - "영세율·면세 줄의 부가세는 기존대로 0원으로 둔다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "신용 전표나 내보내기 등 다른 곳이 부가세를 따로 계산하는지 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 할인 적용 후 금액에 매겨 원 단위 버림으로 계산하고 그 합을 부가세로 쓴다. 합계에서 다시 반올림하지 않는다 (회계팀 규칙) (사람)"
  - "INV-2031의 회계팀 합계는 29,079원이다 (공급가액 26,438원 + 부가세 2,641원) (사람)"
---
## 요약
청구서 합계가 회계팀보다 크게 나오는 버그의 의도 초안을 썼다. 기대 규칙은 줄별 버림 부가세이고, INV-2031은 29,079원이어야 한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:30`: 현재 부가세는 과세 공급가액 합에 `Math.round`를 한 번 적용한다. 줄별 계산이 아니다. 줄 단위 부가세 계산은 없다.
- `src/money.js`의 `percentOf`는 반올림이라 그대로 쓰면 안 된다 (내 가설, 확인 안 됨).
- 확인 계산: 줄별 부가세 536+633+325+837+310 = 2,641원, 합계 29,079원.
- 테스트 명령: `npm test` (`node --test`). 기존 테스트 `test/total.test.js`.
