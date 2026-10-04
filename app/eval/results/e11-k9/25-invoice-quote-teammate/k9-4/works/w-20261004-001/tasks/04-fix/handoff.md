---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 계산을 src/invoice/vat.js 한 곳으로 모아 청구서·반품 전표·견적서가 함께 쓴다"
    why: "세 문서가 같은 회계 규정(줄별 원 단위 내림 합, 할인 뒤 줄 금액 기준)을 따라야 하고 사람이 추가 지시함"
    by: ai
  - what: "견적서 부가세를 할인 전 금액 기준에서 할인된 줄 금액 기준으로 바꾼다"
    why: "사람 지시: 할인은 부가세 전에 줄마다 적용"
    by: human
assumptions:
  - "반품 전표의 돌려받는 줄 할인(returnedDiscount)은 기존 반올림 규칙을 그대로 둠(부가세 외 규칙)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적서 부가세가 줄별 내림이라 이미 안내한 견적과 몇 원 달라질 수 있음"
  - "저장된 totals가 없는 반품 전표나 초안 청구서는 새 규칙으로 다시 계산됨"
recommended_next: null
knowledge_candidates:
  - "부가세는 줄마다 원 단위 내림해 합산하고 합계에서 다시 반올림하지 않는다. 청구서, 반품 전표, 견적서 모두 같다 (사람)"
  - "할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (사람)"
  - "부가세 계산은 src/invoice/vat.js의 lineVat/sumLineVat을 쓴다"
---
## 요약
청구서, 반품 전표, 견적서의 부가세를 줄별 내림 합으로 통일했다. INV-2031은 29,079원이다. `npm test` 51개 통과.
## 다음 task가 알아야 할 것
- 새 파일 `src/invoice/vat.js`; 사용처 `total.js`, `credit-note.js`, `quote.js`
- CN-0112(INV-2047 기준) 부가세 1,744 -> 1,742, Q-0457 부가세 3,589 -> 3,587
- 재현 테스트 3개: total/quote/credit-note 테스트의 새 케이스. 수정 전 실패 확인함
- 발행 저장 합계와 `src/format/` 코드는 미변경
