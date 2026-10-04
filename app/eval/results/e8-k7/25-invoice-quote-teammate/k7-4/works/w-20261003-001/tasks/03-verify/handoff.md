---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(면세 혼합 테스트 추가)을 반영"
    why: "사람이 모두 반영을 선택"
    by: human
assumptions:
  - "줄 금액이 음수인 경우는 없다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "credit-note.js:90, quote.js:40은 부가세를 따로 계산해 청구서와 어긋날 수 있음 (범위 밖)"
  - "INV-2031 외 다른 예제 합계는 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)을 반영해 테스트를 추가했고, 7개 완료조건이 모두 통과했다. INV-2031은 vat 2,641, 합계 29,079원이며 `npm test`는 51개 통과다.
남긴 지식: docs/knowledge/vat-per-line-floor.md, docs/knowledge/issued-invoice-no-recalc.md, docs/knowledge/vat-separate-calc-in-quote-credit-note.md
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 vat 계산, 테스트: `test/total.test.js` 끝의 3개
- 커밋: 627ef9e(테스트), 그 뒤 docs 커밋
- 범위 밖: `src/invoice/credit-note.js:90`, `src/invoice/quote.js:40`
