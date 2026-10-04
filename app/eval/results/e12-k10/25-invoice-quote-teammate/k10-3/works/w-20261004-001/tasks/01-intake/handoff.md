---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 줄마다 할인 후 금액의 10%를 원 단위 버림으로 계산하고 합산한다. 합계에서 다시 반올림하지 않는다"
    why: "사람이 회계팀 규칙으로 직접 알려 줌. INV-2031 회계팀 합계 29,079원"
    by: human
assumptions:
  - "면세 줄과 영세율은 지금처럼 부가세 0으로 둔다 (요청에 바꾸라는 말 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적서(`src/invoice/quote.js`)와 반품 전표(`src/invoice/credit-note.js`)가 같은 부가세 계산을 쓰는지 확인하지 않았다. 사람이 범위를 말하지 않았다"
recommended_next: null
knowledge_candidates:
  - "부가세는 과세 품목 줄마다 할인 후 금액의 10%를 원 단위 버림으로 계산해 합산한다. 합계에서 다시 반올림하지 않는다 (회계팀 규칙) (사람)"
---
## 요약
INV-2031 합계가 회계팀보다 큰 문제의 의도 초안을 썼다. 회계팀 규칙은 사람이 알려 줬다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: `vat = Math.round(taxable * 10 / 100)`로 과세 공급가액 합계에 한 번 반올림한다. 이것이 의심 지점이다 (확인은 fix에서).
- INV-2031 계산: 공급가액 26,438원. 현재 부가세 2,644원, 합계 29,082원. 회계팀 줄별 버림 2,641원, 합계 29,079원.
- `src/money.js`의 `percentOf`는 반올림(`Math.round`)이다. 다른 곳에서 쓰는지 fix에서 확인할 것.
- 테스트: `npm test` (`node --test`), 관련 파일 `test/total.test.js`.
