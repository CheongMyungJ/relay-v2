---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세도 청구서와 같은 줄별 원 단위 버림 규칙을 쓴다"
    why: "팀 지식의 규칙은 청구서 합계만 적어 사람에게 확인했고, 같은 규칙으로 답함"
    by: human
assumptions:
  - "견적서(quote.js)는 이번 요청 범위 밖이라 비목표로 둠"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적서는 반올림 방식 그대로라 반품 전표와 몇 원 차이가 날 수 있음"
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 청구서 줄별 버림(total.js)"
recommended_next: null
knowledge_candidates:
  - "반품 전표(credit-note.js)의 부가세도 청구서와 같은 줄별 원 단위 버림 규칙을 쓴다 (사람)"
---
## 요약
반품 전표 환불 부가세를 청구서와 같은 회계팀 규칙(줄별 버림)으로 맞추는 버그 수정 의도를 정리했다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 부가세를 `Math.round(taxable*세율/100)`로 합계에서 한 번 계산함. CN-0112 현재 합계 19,182원.
- 기대값(참고): 줄별 net 9236/6127/2075 -> 부가세 923/612/207 = 1,742원, 합계 19,180원.
- 반품 줄 할인은 `returnedDiscount`에서 반올림(`percentOf`)함. 이 부분은 요청에 없어 건드리지 않음.
- 저장된 totals는 `creditNoteTotals`가 그대로 반환함. 유지해야 함.
- 참고 지식: docs/knowledge/vat-also-computed-in-quote-and-credit-note.md, vat-per-line-floor-after-discount.md, issued-invoice-keeps-stored-totals.md (모두 기준 브랜치에 아직 없음)
- 테스트: `npm test` (test/credit-note.test.js)
