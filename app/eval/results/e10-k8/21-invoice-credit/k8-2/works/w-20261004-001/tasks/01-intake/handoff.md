---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 품목 줄마다 할인 적용 후 금액에 10%를 매겨 원 단위 버림, 그 합을 청구서 부가세로 한다"
    why: "사람 답: 회계팀 방식. 합계에서 다시 반올림하지 않음. 회계팀 INV-2031 합계 29,079원"
    by: human
  - what: "반품 전표(src/invoice/credit-note.js)도 같은 규칙으로 고친다"
    why: "사람이 범위에 포함하라고 답함"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행 완료 청구서를 재계산하지 않는 경계(저장 합계 사용)가 코드 어디인지 아직 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "부가세는 과세 품목 줄마다 할인 후 금액 기준으로 원 단위 버림하고 그 합이 청구서 부가세다. 합계에서 다시 반올림하지 않는다 (사람)"
  - "이미 발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다. src/format/ 출력 형식은 바꾸지 않는다 (사람)"
---
## 요약
청구서 부가세를 줄별 원 단위 버림 합으로 바꾸는 버그 수정 intent 초안을 썼다. 반품 전표도 포함한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:26`: 현재 `Math.round((taxable * 10) / 100)`로 과세분 합계에 한 번만 반올림.
- `src/invoice/credit-note.js:90`: 같은 방식의 부가세 계산.
- INV-2031: 공급가액 26,438원. 줄별 버림 부가세 536+633+325+837+310=2,641원, 합계 29,079원. 현재 코드는 2,644원, 29,082원.
- 테스트: `npm test` (`node --test`), 관련 `test/total.test.js`, `test/credit-note.test.js`.
- `src/money.js`의 `percentOf`는 반올림이라 그대로 쓰면 안 됨.
