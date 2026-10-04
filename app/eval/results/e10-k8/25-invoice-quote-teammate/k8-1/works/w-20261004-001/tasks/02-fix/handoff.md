---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "수정 범위는 청구서 계산(`computeTotals`)만으로 한다"
    why: "의도가 청구서 합계만 다룬다. 견적과 반품 전표는 별도 구현이라 이번 수정에 영향받지 않고 건드리지 않았다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적(`src/invoice/quote.js` quoteTotals)은 할인 전 금액에 부가세를 매기는 방식이고, 반품 전표(`src/invoice/credit-note.js` creditTotals)는 합계 반올림을 쓴다. 둘 다 회계팀 규칙과 다를 수 있으나 의도 밖이라 그대로 뒀다"
  - "src/format/ 코드는 수정하지 않았다. 다만 발행 전 초안을 서식으로 찍으면 합계 값은 새 규칙을 따른다"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 할인 후 줄 금액마다 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다 (회계팀 규칙) (사람)"
  - "발행 청구서는 `invoiceTotals`(src/invoice/invoice.js)가 저장된 합계를 그대로 쓴다. 반품 전표도 `creditNoteTotals`로 같다"
---
## 요약
`computeTotals`의 부가세를 합계 반올림에서 줄별 버림 합산으로 바꿨다. INV-2031 합계는 29,079원이다. 재현 테스트 2개를 추가했고 `npm test`는 50개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/total.js`의 `lineVat`와 `computeTotals`
- 저장 합계 경로: `src/invoice/invoice.js`의 `invoiceTotals`는 draft가 아니고 totals가 있으면 재계산하지 않는다
- 견적과 반품 전표는 별도 계산식이라 바뀌지 않았다. 같은 규칙을 적용할지는 사람이 정해야 한다
- 테스트 명령: `npm test`
