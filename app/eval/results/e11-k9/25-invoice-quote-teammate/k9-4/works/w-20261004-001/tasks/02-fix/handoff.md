---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "청구서(computeTotals)만 줄별 내림으로 수정하고 반품 전표·견적서는 그대로 둔다"
    why: "범위 확대 여부를 물었고 사람이 '청구서만 수정'을 선택함"
    by: human
assumptions:
  - "줄별 내림 기준은 할인 후 공급가액(net)이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(credit-note.js creditTotals)는 합계 기준 반올림이라, 부분 반품 시 원 청구서의 줄별 내림 부가세와 몇 원 차이날 수 있음"
  - "견적서(quote.js quoteTotals)도 별도 방식이라 청구서와 몇 원 다를 수 있음"
  - "발행 청구서 비재계산은 기존 invoiceTotals 동작에 의존하며 이번에 테스트를 추가하지 않음"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 과세 줄마다 원 단위 내림한 값의 합이다 (사람)"
  - "아직 규칙을 따르지 않음: src/invoice/credit-note.js creditTotals, src/invoice/quote.js quoteTotals — 합계 기준 반올림, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
INV-2031 합계를 29,082원에서 29,079원으로 바로잡았다. 부가세를 과세 줄별 내림 합으로 계산한다. `npm test` 49개 통과.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`의 `vat` 계산만 변경
- 재현 테스트: `test/total.test.js` 마지막 테스트
- 반품 전표·견적서는 범위에서 제외(사람 선택)
