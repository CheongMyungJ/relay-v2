---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 부가세의 기준 금액은 할인 후 공급가액(net)으로 하고 견적서도 같게 맞춘다"
    why: "intake의 가정과 intent의 '줄마다 버림, 합산' 규칙"
    by: ai
assumptions:
  - "견적서는 기존의 '할인 전 금액 기준' 계산을 버리고 net 기준으로 바꿨다"
rejected:
  - "저장된 totals 재계산 경로: invoice.js:41이 발행 후 저장값을 쓰므로 해당 없음"
open_questions: []
intent_deviation: null
risks:
  - "견적서 부가세가 할인 있는 줄에서 이전과 달라질 수 있다"
  - "반품 전표는 줄 부가세가 원 청구서 줄 부가세와 1원 어긋날 수 있다"
recommended_next: null
knowledge_candidates:
  - "부가세 규정: 품목 줄마다 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다 (사람)"
---
## 요약
청구서·반품 전표·견적서의 부가세를 과세 줄마다 net에 원 단위 버림 후 합산하도록 고쳤다. INV-2031은 29,079원이다. `npm test` 51개 통과.
## 다음 task가 알아야 할 것
- `src/money.js` `percentOfFloor` 추가, `total.js`, `credit-note.js`, `quote.js`에서 사용.
- 재현 테스트 3개는 기준 소스에서 실패, 수정 후 통과.
- 기존 테스트는 바꾸지 않았다. `src/format/`은 변경 없음.
