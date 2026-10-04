---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림 후 합산하고, 합계에서 다시 반올림하지 않는다"
    why: "사람이 회계팀 규칙으로 답함. 할인은 부가세 전에 줄별 적용"
    by: human
  - what: "INV-2031의 기대 합계는 29,079원"
    why: "사람이 회계팀 계산값으로 알려 줌. 줄별 버림 규칙으로 계산하면 일치함"
    by: human
assumptions:
  - "견적서와 반품 전표는 사람 요청으로 범위에 포함됨. 둘 다 computeTotals를 쓰지 않고 부가세를 따로 계산함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적서 부가세는 총액 기준으로 계산해 줄별 합과 다를 수 있음. 영업 시스템이 견적 필드를 읽으므로 필드 모양을 유지해야 함"
  - "이미 발행된 청구서와 새로 계산한 값이 다를 수 있으나 저장 합계를 쓰므로 영향 없음"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 품목 줄마다 원 단위 버림으로 계산해 합산하고 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄별 적용한다 (사람)"
---
## 요약
INV-2031 합계가 회계팀보다 3원 큰 문제를 버그 수정으로 정리했다. 회계팀 규칙은 줄별 부가세 버림 합산이다. 기대 합계는 29,079원이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: `vat`를 과세 합계에 `Math.round`로 한 번 계산함. 줄별 계산이 아님
- `lineAmounts`가 줄별 `net`과 `taxable`을 이미 돌려줌
- INV-2031 줄별 부가세 536, 633, 325, 837, 310, 합 2,641원
- `src/invoice/quote.js:40-44`: 부가세를 총액 기준 `percentOf`로 계산함 (줄별 아님)
- `src/invoice/credit-note.js:90`: 과세분 합계에 `Math.round`로 한 번 계산함
- 사람 요청: 수정 후 INV-2031, INV-2047, Q-0457, CN-0112를 줄별 버림 규칙으로 손계산해 비교하고 기록
- 테스트: `npm test`, 기존 `test/total.test.js`의 vat 기대값(6167, 430, 7730)이 새 규칙에서 바뀔 수 있음. 바뀌면 규칙에 맞춰 근거를 남길 것
