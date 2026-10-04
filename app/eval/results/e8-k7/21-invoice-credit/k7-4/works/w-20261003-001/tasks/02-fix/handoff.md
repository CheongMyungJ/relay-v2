---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(creditTotals)의 부가세도 줄별 버림으로 함께 고친다"
    why: "청구서와 같은 규칙을 써야 환불 부가세가 청구 부가세와 어긋나지 않는다. 범위 확대라 사람에게 물었다"
    by: human
  - what: "줄별 부가세 계산을 total.js의 lineVat/vatOfRows 하나로 모으고 반품 전표도 이를 쓴다"
    why: "같은 규칙의 복사 코드를 없애기 위해"
    by: ai
assumptions:
  - "이미 저장된 totals와 발행된 청구서는 재계산하지 않는다(비목표)"
rejected:
  - "합계에서 Math.floor로 바꾸기: 2,643원이라 기대값 2,641과 다르다"
  - "내보내기(export)도 계산이 어긋남: 저장된 totals.vat만 읽고 직접 계산하지 않는다"
open_questions: []
intent_deviation: null
risks:
  - "이미 저장된 반품 전표·청구서의 totals는 옛 방식 값이라 새 계산과 몇 원 다를 수 있다"
  - "반품 전표 변경은 intent 완료조건 밖의 범위 확대(사람이 승인)"
recommended_next: null
knowledge_candidates:
  - "반품 전표(credit-note.js)도 청구서와 같은 부가세 규칙(줄별 원 단위 버림 후 합산)을 쓴다 (사람)"
  - "부가세 계산은 src/invoice/total.js의 lineVat/vatOfRows에 모여 있다. export는 저장된 totals만 읽는다"
---
## 요약
부가세를 합계에서 한 번 반올림하던 것을 과세 줄마다 원 단위 버림 후 합산으로 고쳤다. INV-2031은 부가세 2,641원, 합계 29,079원이다. 반품 전표도 같게 고쳤다. 테스트 4건을 추가했고 `npm test`는 50건 모두 통과한다.
## 다음 task가 알아야 할 것
- 커밋 f3240a8. 변경: `src/invoice/total.js`(lineVat, vatOfRows), `src/invoice/credit-note.js`(creditTotals).
- 새 테스트는 수정 전 4건 실패, 수정 후 통과.
- 반품 전표 `creditTotals`는 total.js를 import한다(순환 없음).
- 저장된 totals는 건드리지 않았다.
