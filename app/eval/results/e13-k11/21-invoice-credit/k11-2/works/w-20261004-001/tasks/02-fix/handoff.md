---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 부가세 계산을 `total.js`의 `lineVat`으로 두고 반품 전표도 이를 쓴다"
    why: "청구서와 반품 전표가 같은 규정을 쓰므로 한 곳에 둠"
    by: ai
assumptions:
  - "반품 할인 안분(`returnedDiscount`)의 반올림은 규정 밖이라 그대로 둠. CN-0112 기대값(합계 19,180원)은 줄별 버림 규정으로 직접 계산한 값"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`examples/INV-2031.json`은 taxType가 없어 raw로 `computeTotals`에 넣으면 면세로 처리된다. `createInvoice`를 거쳐야 한다."
  - "발행본 청구서는 저장된 합계를 쓴다는 점은 코드로 따로 확인하지 않음. `computeTotals`는 발행 전 계산 경로에서만 바뀜"
recommended_next: null
knowledge_candidates:
  - "부가세는 줄마다 `lineVat`(`src/invoice/total.js`)으로 원 단위 버림 계산 후 합산한다. 청구서와 반품 전표 모두 적용 (사람)"
---
## 요약
부가세를 줄별 원 단위 버림 합으로 바꿨다. INV-2031은 2,641원/29,079원, CN-0112는 부가세 1,742원/합계 19,180원이다. `npm test` 50개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` `lineVat`, `computeTotals`; `src/invoice/credit-note.js` `creditTotals`
- `src/format/` 변경 없음
- 테스트: `npm test`, 신규 테스트는 total.test.js, credit-note.test.js 끝부분
