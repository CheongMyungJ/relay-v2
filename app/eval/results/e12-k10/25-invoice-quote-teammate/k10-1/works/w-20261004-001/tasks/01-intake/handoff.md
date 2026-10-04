---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용한다"
    why: "회계팀 규정(사람 답변). INV-2031이 29,079원으로 맞아떨어짐"
    by: human
  - what: "적용 범위에 견적(quote.js)과 대변전표(credit-note.js)를 포함한다"
    why: "사람이 범위 질문에 '견적·대변전표도 포함'을 선택"
    by: human
assumptions:
  - "이미 발행된 청구서는 저장된 합계를 쓰므로 계산 경로 변경의 영향을 받지 않는다고 가정(확인 안 함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적은 총액 기준으로 부가세를 계산해 줄별 버림으로 바꾸면 기존 견적 테스트 기대값이 달라질 수 있음"
  - "발행 청구서를 재계산하는 경로(예: 내보내기, 월 집계)가 있는지 fix에서 확인 필요"
recommended_next: null
knowledge_candidates:
  - "부가세 규정: 품목 줄마다(할인 적용 후 금액) 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다 (사람)"
  - "발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다 (사람)"
---
## 요약
청구서 부가세를 회계팀 규정(줄별 원 단위 버림 합산)으로 바꾸는 intent 초안을 썼다. 범위는 청구서, 견적, 대변전표다.
## 다음 task가 알아야 할 것
- 부가세 계산 위치: `src/invoice/total.js:27`(청구서, 합계에 `Math.round`), `src/invoice/credit-note.js:90`(대변전표, 같은 방식), `src/invoice/quote.js:40-44`(견적, 총액 기준 `percentOf` 차감 방식).
- INV-2031 검산: 줄 공급가 5368, 6335, 3255, 8375, 3105 → 줄별 버림 부가세 536, 633, 325, 837, 310 = 2641, 합계 29,079.
- 테스트: `npm test`(node --test). `test/total.test.js`, `quote.test.js`, `credit-note.test.js` 참고.
- 참고용 가설(확인 안 됨): 합계 단위 `Math.round`가 원인으로 보임.
