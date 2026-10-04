---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(src/invoice/credit-note.js creditTotals)의 부가세는 이번에 바꾸지 않는다"
    why: "intent는 청구서 합계만 다룬다. 같은 규칙을 반품에도 적용할지는 범위 확대라 사람 결정이 필요하다"
    by: ai
assumptions:
  - "부가세 버림은 `Math.floor`로 하며 금액은 항상 0 이상이다"
rejected:
  - "발행분 재계산 의심: invoiceTotals가 저장된 totals를 쓴다"
open_questions: []
intent_deviation: null
risks:
  - "creditTotals는 여전히 합계에 Math.round를 쓴다. 반품 부가세가 원 청구서와 몇 원 어긋날 수 있다"
  - "버그 재현 스크립트는 레포 밖(/tmp/r.mjs)에 있다"
recommended_next: null
knowledge_candidates:
  - "정하지 않음 없음. 아직 규칙을 따르지 않음: src/invoice/credit-note.js creditTotals — 부가세를 합계에 한 번 Math.round, 이번 범위에서 다루지 않음"
---
## 요약
부가세를 과세 줄마다 할인 후 금액 기준 원 단위 버림으로 계산해 합산하도록 고쳤다. INV-2031은 29,079원. 테스트 48개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` `lineVat`/`computeTotals`
- 테스트: `test/total.test.js` 끝 2개
- 반품 전표 `creditTotals`(src/invoice/credit-note.js:90)는 미수정
