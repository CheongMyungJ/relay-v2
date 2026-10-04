---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄별 할인 후 금액 × 세율의 원 단위 버림 합산으로 계산한다"
    why: "docs/knowledge/vat-per-line-floor-after-discount.md 및 intake에서 사람이 확인한 결정"
    by: ai
  - what: "returnedDiscount의 반올림은 건드리지 않는다"
    why: "요청 범위 밖 (intake handoff에서 명시)"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적서(quote.js)는 반올림 방식 그대로라 반품 전표와 몇 원 차이가 날 수 있음"
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 청구서 줄별 버림(total.js). 이 브랜치의 total.js는 아직 합계 반올림"
knowledge_candidates: []
recommended_next: null
---
## 요약
반품 전표 부가세를 과세 줄별 버림 합산으로 바꿨다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다. 테스트 2개를 추가했고 `npm test`는 50개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 부가세 줄별 `Math.floor` 합산.
- 테스트: test/credit-note.test.js 끝의 새 테스트 2개. 수정 전 실패를 확인함.
- 저장된 totals를 쓰는 `creditNoteTotals`와 `src/format/`은 바꾸지 않음.
