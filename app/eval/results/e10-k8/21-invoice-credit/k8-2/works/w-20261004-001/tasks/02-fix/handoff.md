---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 버림 계산을 `src/invoice/vat.js`의 `computeVat`으로 분리해 청구서와 반품 전표가 함께 쓴다"
    why: "같은 규칙을 두 곳에 복사하지 않기 위함"
    by: ai
assumptions: []
rejected:
  - "`percentOf` 재사용: 반올림이라 버림 규칙과 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "음수나 0원 줄은 별도로 확인하지 않음(줄 금액이 0이면 부가세 0)"
  - "반품 전표에서 줄별 할인은 기존 returnedDiscount(반올림)를 그대로 둠(비목표: 할인 계산 불변)"
recommended_next: null
knowledge_candidates:
  - "부가세 계산은 `src/invoice/vat.js`의 `computeVat` 한 곳에서 한다. 청구서와 반품 전표가 같이 쓴다"
  - "줄 금액이 모두 10원 단위이면 합계 반올림과 줄별 버림이 같아서 기존 테스트로는 이 버그가 드러나지 않았다. 부가세 테스트는 10원 단위가 아닌 금액을 쓴다"
---
## 요약
부가세를 합계 반올림에서 과세 줄별 원 단위 버림의 합으로 바꿨다. 청구서와 반품 전표 모두 적용했고 INV-2031은 2,641원/29,079원이 된다.
## 다음 task가 알아야 할 것
- `src/invoice/vat.js`: `computeVat`. 호출은 `src/invoice/total.js`와 `src/invoice/credit-note.js`의 `creditTotals`.
- 테스트: `npm test` 50건 통과. 새 테스트 `test/total.test.js` 2건, `test/credit-note.test.js` 2건. 수정 전에는 3건 실패.
- 커밋 2개. `src/format/` 변경 없음. 기존 테스트 변경 없음.
- 저장된(발행된) 합계 경로(`invoice.js:41`, `creditNoteTotals`)는 그대로 둠.
