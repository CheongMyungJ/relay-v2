---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "vat를 줄별 floor 후 합산하고 credit-note.js는 건드리지 않음"
    why: "비목표: 합계 계산(src/invoice/total.js) 외의 수정은 하지 않는다"
    by: ai
assumptions:
  - "발행된 청구서는 invoiceTotals가 저장된 totals를 쓰므로 영향 없다고 코드로 확인함 (invoice.js:41), 별도 테스트는 추가하지 않음"
rejected:
  - "합계에서 부가세 절사: 합계 절사는 2,643원이라 기대값 2,641과 다름"
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/credit-note.js:90에 같은 합계 기준 반올림이 남아 있어 반품 전표 부가세가 청구서와 어긋날 수 있음 (비목표라 수정 안 함)"
  - "draft 상태 청구서와 아직 발행 안 된 청구서의 합계는 새 규칙으로 바뀜"
recommended_next: null
knowledge_candidates:
  - "아직 규칙을 따르지 않음: src/invoice/credit-note.js:90 — 합계 기준 Math.round로 부가세 계산, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
부가세를 과세 줄마다 (할인 후 금액 × 10%) 원 단위 버림해 합산하도록 고쳤다. INV-2031은 29,079원이다. 재현 테스트 2개를 추가했고 `npm test`는 48개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:26-29`: 줄별 floor 합산
- `test/total.test.js` 끝의 테스트 2개
- `src/format/`은 변경 없음
- `credit-note.js:90`은 옛 방식 그대로
