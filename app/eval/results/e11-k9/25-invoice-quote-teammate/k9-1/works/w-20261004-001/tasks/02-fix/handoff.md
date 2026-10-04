---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서와 반품 전표의 부가세도 청구서와 같은 줄별 버림 합산으로 맞췄다"
    why: "사람이 '회계 규정은 하나'라며 견적서와 반품 전표도 같은 규칙으로 맞추라고 지시함"
    by: human
  - what: "발행된 청구서와 저장된 합계는 재계산하지 않고, `src/format/`은 건드리지 않았다"
    why: "사람이 다시 확인해 준 제약"
    by: human
assumptions:
  - "발행된 청구서는 `invoiceTotals`가 저장된 합계를 쓰므로(invoice.js) 이번 수정의 영향을 받지 않는다고 봄. 코드로만 확인했고 별도 테스트는 없음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행 전(draft) 청구서·견적서·새로 만드는 반품 전표의 합계는 바뀐다. 이미 저장된 전표(예: INV-2047 저장 부가세 5,801)는 그대로라 CN-0112(1,742)와 원 청구서 기준이 다르다. 사람이 재계산하지 말라고 한 결과"
recommended_next: null
knowledge_candidates:
  - "회계 규정은 하나다: 부가세는 줄마다 원 단위 버림으로 계산해 합치고 합계에서 다시 반올림하지 않는다. 청구서, 견적서, 반품 전표 모두 같다 (사람)"
  - "부가세 줄 계산은 `src/invoice/total.js`의 `lineVat`를 공유한다"
---
## 요약
`computeTotals`가 과세 합계에 반올림을 한 번만 해서 INV-2031이 29,082원으로 나왔다. 과세 줄마다 10%를 원 미만 버림으로 계산해 합산하도록 고쳐 29,079원(부가세 2,641)이 된다. 사람 요청으로 견적서와 반품 전표도 같은 규칙으로 맞췄다. 테스트를 추가했고 `npm test` 57개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 `lineVat`와 `computeTotals`의 `vat`
- 테스트: `test/total.test.js` 6~9번째, `test/quote.test.js`, `test/credit-note.test.js` 끝부분
- 같은 규칙 적용: `src/invoice/quote.js` `quoteTotals`, `src/invoice/credit-note.js` `creditTotals`
- 새 값: Q-0457 부가세 3,587 / 합계 56,278, CN-0112 부가세 1,742 / 합계 19,180
- `src/format/`은 변경 없음
