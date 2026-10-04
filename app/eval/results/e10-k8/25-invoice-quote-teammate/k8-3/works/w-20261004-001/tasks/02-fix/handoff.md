---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "수정 범위는 computeTotals(청구서)로 한정하고 견적서·반품 전표의 부가세 계산은 바꾸지 않는다"
    why: "intent의 목표가 새로 계산하는 청구서이며, 다른 경로까지 넓히는 것은 범위 확장이라 하지 않음"
    by: ai
assumptions:
  - "VAT_RATE_PERCENT는 정수 10이라 Math.floor(net*10/100)에 부동소수 오차가 없다"
rejected:
  - "percentOf 변경: 부가세는 이 함수를 쓰지 않고 할인에도 쓰이는 공용 함수라 영향이 큼"
  - "taxType 누락이 원인: normalizeLine이 기본 'taxable'로 채워서 전부 과세로 계산됨"
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/quote.js(견적)와 src/invoice/credit-note.js(반품 전표)는 여전히 이전 방식으로 부가세를 계산해 청구서와 몇 원 다를 수 있음. 같은 규칙을 적용할지는 사람 판단 필요"
  - "초안(draft) 청구서의 합계는 매번 재계산되므로 수정 후 값이 바뀜. 발행·입금된 청구서는 저장된 합계를 그대로 써서 불변"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 src/invoice/total.js computeTotals에서 과세 줄마다 할인 후 금액의 원 단위 버림 합으로 계산한다. 견적(quote.js)과 반품 전표(credit-note.js)는 아직 합계 반올림 방식이다"
---
## 요약
INV-2031 합계가 29,082원으로 나온 원인은 과세 합계에 한 번만 반올림한 것이었다. 줄별 버림 합으로 바꿔 29,079원이 나오고, 테스트 2개를 추가했다. `npm test` 50개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 `lineVat`, `computeTotals` vat.
- 테스트: `test/total.test.js` 마지막 두 테스트. 수정 전 2개 실패, 수정 후 통과.
- 견적·반품 전표의 부가세 계산은 그대로다(위 risks 참고).
- `src/format/`과 발행 청구서의 저장 합계 사용 방식(`invoiceTotals`)은 변경 없음.
