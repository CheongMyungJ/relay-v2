---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표와 견적서의 부가세도 같은 줄별 버림 규정으로 같이 고친다"
    why: "사람의 답: 회계 규정은 부가세 전반에 적용된다. 단 발행분 재계산 금지, src/format/ 출력 유지"
    by: human
  - what: "줄별 부가세 계산을 `lineVat`/`sumLineVat`으로 total.js에 두고 세 곳이 공유한다"
    why: "규정이 한 곳에서만 정의되도록"
    by: ai
assumptions:
  - "견적서는 생성 때 totals를 저장하므로 이미 만든 견적은 바뀌지 않는다고 봄 (quoteTotals 호출처는 createQuote뿐)"
rejected:
  - "단순 반올림 방식 조정: 규정은 버림이고 줄마다 적용해야 해서 합계 반올림만 바꿔서는 부족"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표와 견적서 변경은 원 의도(청구서)보다 범위가 넓음. 사람이 요청해 반영함"
  - "반품 전표의 할인 금액(returnedDiscount)과 견적 할인 산출 방식은 바꾸지 않음"
recommended_next: null
knowledge_candidates:
  - "회계 규정은 부가세 전반(청구서, 반품 전표, 견적서)에 적용된다: 줄마다 할인 후 금액에 원 단위 버림 (사람)"
  - "부가세 계산은 src/invoice/total.js의 lineVat/sumLineVat을 쓴다. 발행된 청구서와 반품 전표는 저장된 totals를 재계산하지 않는다"
  - "examples/*.json은 createInvoice로 정규화해야 taxType가 채워진다. 그대로 computeTotals에 넣으면 전 줄이 면세로 계산됨"
---
## 요약
부가세를 줄마다 할인된 공급가액의 10%를 버림해 합산하도록 고쳤다. INV-2031은 2,641원/29,079원. 사람 요청으로 반품 전표와 견적서도 같이 고쳤다. `npm test` 52건 통과.
## 다음 task가 알아야 할 것
- `src/invoice/total.js`: `lineVat`, `sumLineVat`. 사용처 `credit-note.js` `creditTotals`, `quote.js` `quoteTotals`.
- 발행분 보존: `invoiceTotals`(invoice.js), `creditNoteTotals`는 저장 totals 사용. 기존 테스트 변경 없음, 추가 테스트 4건.
- `src/format/` 변경 없음.
