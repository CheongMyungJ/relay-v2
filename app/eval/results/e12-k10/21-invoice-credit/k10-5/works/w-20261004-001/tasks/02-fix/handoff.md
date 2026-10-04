---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세(creditTotals)도 같이 줄별 버림으로 고친다"
    why: "범위가 넓어지는 선택이라 사람에게 물었고, 사람이 같이 고치기를 골랐다"
    by: human
  - what: "줄별 부가세 계산을 total.js의 sumLineVat 하나로 두고 반품 전표가 가져다 쓴다"
    why: "계산식 중복 제거"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 수정은 intent 본문 밖이다. 저장된 전표 금액은 재계산하지 않는다"
  - "반품 전표 재현 테스트는 수정 전 실패를 따로 확인하지 않았다"
  - "할인 계산(percentOf, 반올림)은 바꾸지 않았다"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세(creditTotals)도 청구서와 같은 줄별 버림 규칙을 쓴다 (사람)"
---
## 요약
부가세를 과세 줄마다 원 단위 버림한 합으로 계산하게 고쳤다. INV-2031은 vat 2,641, total 29,079원이다. 반품 전표도 같이 고쳤다. `npm test` 50개 통과.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat`/`sumLineVat`: 줄별 floor 후 합산
- `src/invoice/credit-note.js` `creditTotals`가 `sumLineVat` 사용
- 발행/저장 경로(`invoiceTotals`, `creditNoteTotals`)와 `src/format/`은 변경 없음
- 테스트: `npm test`, 신규 4개
