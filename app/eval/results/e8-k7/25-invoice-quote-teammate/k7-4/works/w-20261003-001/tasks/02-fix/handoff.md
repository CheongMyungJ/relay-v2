---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세를 줄별 Math.floor 합으로 계산하고, quote.js와 credit-note.js는 고치지 않음"
    why: "intent는 청구서 합계(computeTotals)만 다룸. 두 파일은 computeTotals를 쓰지 않고 별도 계산을 가짐"
    by: ai
assumptions:
  - "INV-2031 외 줄 금액이 음수인 경우는 없다고 가정 (Math.floor)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/credit-note.js:90은 합계에 Math.round를 쓰고, src/invoice/quote.js:40은 다른 방식이라 청구서와 부가세가 어긋날 수 있음 (범위 밖이라 그대로 둠)"
  - "예제 INV-2047 등 다른 예제의 합계는 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 줄별 할인 후 금액에 원 단위 버림 후 합산 (회계팀 규칙) (사람)"
  - "credit-note.js와 quote.js는 computeTotals를 쓰지 않고 부가세를 따로 계산함: 규칙 변경 시 함께 봐야 함"
---
## 요약
부가세를 줄별 버림 합으로 계산하도록 고쳤다. INV-2031은 vat 2,641, 합계 29,079원이다. 테스트 2개를 추가했고 `npm test`가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 `computeTotals` vat 계산
- 테스트: `test/total.test.js` 끝의 두 테스트
- `src/format/`은 변경 없음. 발행된 청구서는 `invoiceTotals`가 저장값을 쓰므로 영향 없음
- 범위 밖: `credit-note.js:90`, `quote.js:40`
