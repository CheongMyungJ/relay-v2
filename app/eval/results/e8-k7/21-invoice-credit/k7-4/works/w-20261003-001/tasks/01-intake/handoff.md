---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 줄마다 원 단위 버림 후 합산, 합계에서 재반올림 없음. 할인은 부가세 전에 줄마다 적용"
    why: "사람이 회계팀 기준으로 답함. INV-2031 기대 합계 29,079원"
    by: human
assumptions:
  - "이미 발행된 청구서의 저장된 totals는 이번 범위에서 바꾸지 않는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(credit-note)와 export가 같은 부가세 규칙을 쓰면 함께 어긋날 수 있음"
recommended_next: null
knowledge_candidates:
  - "회계팀 기준 부가세: 품목 줄마다 원 단위 버림 후 합산하며 합계에서 재반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 할인된 줄 금액에 부가세를 매긴다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 몇 원 크게 나오는 버그의 의도를 정리했다. 기대 규칙은 줄별 버림 부가세다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 현재 부가세는 과세 공급가액 합에 10%를 곱해 `Math.round` (참고용 관찰, 원인 확인 전).
- INV-2031 줄 공급가액 5368, 6335, 3255, 8375, 3105 (합 26438). 줄별 버림 부가세 536, 633, 325, 837, 310 (합 2641). 합계 29,079원.
- 테스트: `npm test` (node --test). `test/total.test.js` 있음.
- 확인 필요: `src/invoice/credit-note.js`, `src/export/`의 부가세 계산.
