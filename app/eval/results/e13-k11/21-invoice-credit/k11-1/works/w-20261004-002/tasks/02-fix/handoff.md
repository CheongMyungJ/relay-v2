---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`lineVat`을 `src/invoice/total.js`에 새로 만들고 `creditTotals`만 쓰게 했다. `computeTotals`는 그대로 둔다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md는 lineVat 한 곳을 쓰라고 한다. 이 브랜치에는 lineVat이 없고, 의도의 비목표가 computeTotals 변경을 막는다"
    by: ai
  - what: "저장된 반품 전표는 재계산하지 않는다"
    why: "docs/knowledge/invoice/issued-invoice-stored-totals.md. creditNoteTotals가 저장값을 쓰므로 새로 만드는 전표에만 적용된다"
    by: ai
assumptions:
  - "회계팀 기대 금액은 줄별 버림 합산(19,180원)이라고 가정했다. 요청에 정확한 금액은 없다"
rejected:
  - "할인 안분(returnedDiscount)이 원인: 공급가액 17,438은 줄별 계산과 같고 부가세 식만 달랐다"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 lineVat을 이미 고쳤을 수 있음, 머지 대기. 머지하면 total.js의 lineVat이 충돌할 수 있으니 하나로 합쳐야 한다. 시그니처가 다르면 creditTotals 호출을 맞춘다"
  - "computeTotals는 아직 Math.round 합계 방식이다(비목표라 안 건드림). 청구서와 반품 전표의 부가세 방식이 이 브랜치에서는 다르다"
recommended_next: null
knowledge_candidates: []
---
## 요약
`creditTotals`의 부가세를 합계에 한 번 `Math.round`하던 방식에서 줄별 `Math.floor` 합으로 고쳤다. CN-0112는 vat 1,744 → 1,742, 합계 19,182 → 19,180원이다. 재현 테스트는 수정 전 실패, 수정 후 통과하고 `npm test`는 48개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 `lineVat`(신규), `src/invoice/credit-note.js`의 `creditTotals`
- 테스트: `test/credit-note.test.js` 끝의 2개(CN-0112, 면세·영세율)
- 재현 입력은 `examples/CN-0112.json`과 `examples/INV-2047.json`. 줄별 부가세는 923, 612, 207
- 앞 Work가 머지되면 `lineVat` 중복·충돌을 확인한다
