---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림으로 계산해 합산하고, 합계에서 재반올림하지 않는다"
    why: "회계팀 규정(사람 답변). INV-2031 회계팀 합계 29,079원과 줄별 버림 합이 일치함"
    by: human
  - what: "적용 범위는 청구서만. 반품 전표(CN)와 견적(Q)은 비목표"
    why: "사람이 '청구서만'을 선택"
    by: human
assumptions:
  - "`npm test`(node --test)가 이 레포의 테스트 명령이다"
  - "발행된 청구서는 저장된 totals를 쓰므로 계산 함수만 고치면 영향이 없다고 가정함(확인 안 됨)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`percentOf`(src/money.js)나 다른 곳이 `computeTotals`의 vat를 공유하면 CN/Q에 영향이 갈 수 있음"
recommended_next: null
knowledge_candidates:
  - "회계 규정: 청구서 부가세는 품목 줄마다 원 단위 버림으로 계산해 합하고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 문제를 버그 수정으로 정리했다. 부가세를 줄별 버림 합으로 바꾸는 것이 목표다. INV-2031은 29,079원이 되어야 한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 지금은 `Math.round(taxable * VAT_RATE_PERCENT / 100)`으로 과세 합계에 한 번만 반올림한다. 줄 단위 계산이 아니다. (참고용, 원인 확정 아님)
- `src/money.js` `percentOf`: 반올림 도우미. CN과 견적도 쓰는지 확인 필요.
- INV-2031 줄별 공급가액: 5,368 / 6,335 / 3,255 / 8,375 / 3,105 → 부가세 536 / 633 / 325 / 837 / 310 = 2,641.
- 테스트: `npm test`, 관련 파일 `test/total.test.js`.
