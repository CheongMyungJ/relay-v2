---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림 후 합산한다. 합계에서 다시 반올림하지 않는다"
    why: "회계팀 규정을 사람이 답함. INV-2031 기대 합계 29,079원"
    by: human
  - what: "반품 전표의 부가세도 같은 규칙으로 맞춘다"
    why: "사람이 범위에 포함하라고 답함"
    by: human
assumptions:
  - "할인 후 줄 금액(net)에 줄별 버림을 적용하고, 면세 줄과 영세율은 부가세 0으로 둔다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표는 줄별 부가세 계산이 현재 구조와 다를 수 있다 (credit-note.js 71, 90행 근처). 부분 반품 수량 비례 반올림이 걸려 있어 fix에서 확인해야 한다"
  - "이미 발행된 청구서와 전표의 저장 합계는 그대로라 새 계산과 다를 수 있다"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 원 단위 버림으로 계산하고 그 합을 청구서 부가세로 쓴다. 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용한다 (사람)"
  - "회계팀 대조 기준: INV-2031 합계는 29,079원 (사람)"
---
## 요약
청구서 부가세를 줄별 버림 방식으로 바꾸고 반품 전표도 같은 규칙으로 맞추는 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- 현재 부가세: `src/invoice/total.js:26`에서 `Math.round(taxable * 10 / 100)`로 합계 전체에 한 번 반올림한다.
- 반품 전표: `src/invoice/credit-note.js:71`(줄 금액 수량 비례 반올림), `:90`(부가세 반올림).
- INV-2031: 공급가액 26,438원, 줄별 버림 부가세 536+633+325+837+310=2,641원, 합계 29,079원. 현재 29,082원.
- 테스트: `npm test`. 서식은 `src/format/`을 건드리지 않는다.
