---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세를 과세 줄마다 Math.floor(할인 후 공급가액 × 10 / 100)의 합으로 계산한다"
    why: "회계팀 규정(intent). INV-2031이 29,079원이 됨"
    by: ai
assumptions: []
rejected:
  - "발행된 청구서 재계산: invoiceTotals가 저장된 totals를 쓰므로 해당 없음"
  - "CN/견적이 computeTotals 공유: credit-note.js와 quote.js가 각자 계산해 영향 없음"
open_questions: []
intent_deviation: null
risks:
  - "credit-note.js:90은 아직 합계 기준 Math.round를 쓴다. 비목표라 그대로 둠. 청구서와 계산이 달라질 수 있음"
  - "net이 음수인 줄은 확인하지 않음(floor는 음수에서 0 반대 방향)"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 과세 줄마다 원 단위 버림으로 계산해 합산하고 합계에서 재반올림하지 않는다 (사람)"
  - "src/invoice/total.js computeTotals가 청구서 부가세 계산 위치. CN(credit-note.js)과 견적(quote.js)은 별도 계산이며 아직 합계 기준 반올림"
---
## 요약
`computeTotals`의 부가세를 줄별 버림 합으로 고쳤다. INV-2031은 29,079원이다. 재현 테스트를 추가했고 `npm test` 53건이 통과했다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` vat 계산 부분이 수정 지점.
- 테스트: `test/total.test.js` 하단 5건 추가.
- `src/format/`은 변경 없음. 커밋은 1개.
