---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "청구서뿐 아니라 반품 전표와 견적도 줄마다 버림 규칙으로 고친다"
    why: "같은 합계 반올림이 따로 구현되어 있어 범위를 물었고 사람이 '청구서 + 반품 전표 + 견적'을 골랐다"
    by: human
  - what: "줄 부가세 계산을 `lineVat`(total.js) 하나로 모아 세 곳이 쓴다"
    why: "규칙이 갈라지지 않게 하기 위해"
    by: ai
assumptions:
  - "면세 줄과 영세율은 0원 그대로 둔다 (intake 가정)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적 부가세 규칙이 바뀌어 견적 금액이 달라질 수 있다 (할인 있는 견적, 줄 단위 소수점)"
  - "반품 전표를 새로 만들 때 줄 버림이 적용된다. 이미 저장된 전표와 청구서는 그대로"
  - "반품 전표의 부분 반품 시 할인 금액 반올림(returnedDiscount)은 바꾸지 않았다"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다(할인된 줄 금액 기준) 원 단위 버림으로 계산해 합산한다. 청구서, 반품 전표, 견적 모두 같은 규칙이다 (사람)"
  - "줄 부가세 계산은 `src/invoice/total.js`의 `lineVat`을 쓴다. 청구서, 반품 전표, 견적이 각자 합계를 계산하니 규칙을 바꿀 때 세 곳을 함께 본다"
---
## 요약
부가세를 줄마다 원 단위 버림으로 계산하게 고쳤다. INV-2031은 29,079원이 된다. 청구서, 반품 전표, 견적에 모두 적용했다(사람 선택). 재현 테스트 4건을 추가했고 `npm test`는 52개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` `lineVat`, `src/money.js` `floorPercentOf`, `credit-note.js` `creditTotals`, `quote.js` `quoteTotals`
- 발행 청구서와 저장된 반품 전표는 저장된 합계를 쓰는 경로(`invoiceTotals`, `creditNoteTotals`)를 그대로 둬 다시 계산되지 않는다
- `src/format/` 변경 없음, 기존 테스트 변경 없음
- 명령: `npm test`
