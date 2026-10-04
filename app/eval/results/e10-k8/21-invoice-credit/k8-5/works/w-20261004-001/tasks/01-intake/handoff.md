---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림 후 합산, 합계에서 재반올림 없음"
    why: "회계팀 규칙을 사람이 답함. INV-2031 기대 합계 29,079원"
    by: human
  - what: "범위는 합계 계산만, 반품 전표는 제외"
    why: "사람이 '합계 계산만'을 선택"
    by: human
assumptions:
  - "면세 줄은 부가세 0, 영세율 청구서는 부가세 0인 기존 동작을 유지한다고 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 코드(내보내기, 서식, 반품 전표)가 computeTotals의 vat 값에 기대고 있을 수 있음"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 할인 적용 후 과세 금액에 원 단위 버림으로 계산하고 그 합을 쓴다. 합계에서 다시 반올림하지 않는다 (사람)"
  - "발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다. src/format/ 출력 형식은 PDF 생성기가 쓰므로 바꾸면 안 된다 (사람)"
---
## 요약
부가세가 합계 과세분에 한 번 반올림되어 INV-2031이 29,082원으로 나온다. 회계팀 방식(줄별 버림 후 합산)으로 바꾸는 의도 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: `Math.round((taxable * VAT_RATE_PERCENT) / 100)`로 전체 과세분에 한 번 반올림.
- 계산 확인: 줄 공급가액 5368, 6335, 3255, 8375, 3105 → 줄별 버림 부가세 536, 633, 325, 837, 310 = 2641, 합계 29,079.
- `src/money.js`의 `percentOf`는 반올림이라 그대로 쓰면 안 됨. 테스트는 `npm test`, `test/total.test.js`.
- 반품 전표 `src/invoice/credit-note.js`는 범위 밖이나 같은 계산을 쓰는지 확인 필요.
