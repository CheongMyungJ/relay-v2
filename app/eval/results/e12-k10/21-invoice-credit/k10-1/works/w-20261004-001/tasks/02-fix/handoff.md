---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "버림 도우미 `floorPercentOf`를 money.js에 추가해 청구서와 반품 전표가 함께 쓴다"
    why: "두 계산이 같은 규칙이어야 한다는 intent에 맞춤"
    by: ai
assumptions:
  - "공급가액이 음수인 줄(할인이 금액보다 큰 경우)은 다루지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "저장된 합계가 있는 기존 청구서와 전표는 그대로라 새 계산과 다를 수 있다 (비목표)"
  - "반품 전표의 부분 반품 할인 수량 비례 반올림(credit-note.js:71)은 할인이라 바꾸지 않았다"
  - "임시 파일 /p.patch(수정 diff 사본)를 지우지 못하고 남겼다. 저장소 밖이며 사람이 지워도 된다"
recommended_next: null
knowledge_candidates:
  - "합계에 한 번 반올림하면 줄 금액이 10의 배수가 아닐 때 줄별 버림 합과 어긋난다. 청구서(total.js)와 반품 전표(credit-note.js)는 같은 줄별 버림 규칙을 쓴다"
---
## 요약
부가세를 과세 줄마다 공급가액×10%를 버림해 합산하도록 청구서와 반품 전표 모두 고쳤다. INV-2031은 부가세 2,641원, 합계 29,079원이 된다.
## 다음 task가 알아야 할 것
- 변경: `src/money.js` `floorPercentOf`, `src/invoice/total.js` vat, `src/invoice/credit-note.js` `creditTotals`
- 새 테스트 3개(total 2, credit-note 1). 수정 전 3개 실패, 수정 뒤 `npm test` 49개 통과
- `src/format/`은 건드리지 않았다
