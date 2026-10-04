---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림, 그 합을 청구서 부가세로 쓴다. 할인은 부가세 전에 줄마다 적용"
    why: "사람이 회계팀 계산 방식으로 직접 답함"
    by: human
  - what: "INV-2031 기대 합계는 29,079원"
    why: "사람이 회계팀 계산 값으로 답함. 줄별 버림(536+633+325+837+310=2,641)과 일치"
    by: human
assumptions:
  - "반품 전표의 부가세 계산은 요청에 없으므로 이번 범위에서 뺀다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(src/invoice/credit-note.js:90)도 합계 기준 Math.round를 써서 같은 불일치가 생길 수 있다. 이번 범위 밖"
  - "이미 발행된 청구서는 저장된 totals를 쓰므로 기존 값은 이번 수정으로 바뀌지 않는다"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 할인 적용 후 금액에 대해 원 단위 버림으로 계산하고 그 합을 청구서 부가세로 쓴다. 합계에서 다시 반올림하지 않는다 (사람)"
---
## 요약
청구서 부가세가 합계 기준 반올림이라 회계팀 계산(줄별 버림)보다 커진다. 줄별 버림으로 맞추는 버그 수정 의도를 정리했다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:27`: `vat = Math.round(taxable * VAT_RATE_PERCENT / 100)` (합계 기준 반올림). `lineAmounts`의 `net`, `taxable`로 줄별 계산 가능
- INV-2031: 공급가액 26,438원, 현재 부가세 2,644원(합계 29,082원), 기대 2,641원(합계 29,079원)
- 반품 전표 `src/invoice/credit-note.js:90`에 같은 방식이 있음(범위 밖)
- 테스트: `npm test`, 관련 파일 `test/total.test.js`
