---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(creditTotals)도 줄별 원 단위 버림으로 함께 고친다"
    why: "범위가 넓어지는 선택이라 물었고 사람이 '반품 전표도 줄별 버림으로 고침'을 골랐다"
    by: human
  - what: "부가세 계산을 src/invoice/vat.js의 rowsVat 하나로 모아 청구서와 반품 전표가 쓴다"
    why: "두 곳의 계산이 어긋나지 않게 하려는 것"
    by: ai
assumptions:
  - "면세 줄과 영세율 청구서도 같은 규칙(면세 0, 영세율 vat 0)을 따른다 (intake 가정)"
rejected:
  - "할인 적용 순서 문제: 할인은 이미 줄별로 부가세 전에 적용되고 있었음"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 수정은 intent 본문에 없던 범위 확장이며 사람이 승인함. 이미 저장된 반품 전표 totals는 다시 계산하지 않음"
  - "이미 발행된 청구서의 저장 합계와 새로 계산한 값이 다를 수 있음 (의도된 비목표)"
recommended_next: null
knowledge_candidates:
  - "부가세는 줄별(할인 후 공급가액) 원 단위 버림 합이며 합계에서 다시 반올림하지 않는다. 반품 전표도 같은 규칙이다 (사람)"
---
## 요약
청구서와 반품 전표의 부가세를 줄별 버림 합으로 바꿨다. INV-2031은 29,082원에서 29,079원이 된다. 테스트 3개를 추가했고 `npm test`는 49개 모두 통과한다.
## 다음 task가 알아야 할 것
- 원인: 합계 과세액에 한 번 `Math.round` (기존 `src/invoice/total.js`, `src/invoice/credit-note.js:90`).
- 수정: `src/invoice/vat.js`의 `rowsVat(rows, zeroRated)`.
- 테스트: `test/total.test.js` 끝 2개, `test/credit-note.test.js` 끝 1개. 수정 전 3개 실패, 후 통과.
- `src/format/` 변경 없음. 기존 테스트 변경 없음.
