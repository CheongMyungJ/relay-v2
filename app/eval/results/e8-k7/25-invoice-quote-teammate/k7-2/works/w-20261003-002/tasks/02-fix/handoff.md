---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 줄마다 net에 원 단위 버림으로 계산해 합산한다"
    why: "팀 지식 docs/knowledge/vat-floor-per-line.md, discount-before-vat.md"
    by: ai
  - what: "creditNoteTotals는 이미 저장된 totals를 반환하므로 고치지 않았다"
    why: "팀 지식 docs/knowledge/issued-invoice-keeps-stored-totals.md, 코드가 이미 규칙대로임"
    by: ai
assumptions:
  - "회계팀 기대값은 팀 지식 규칙으로 계산한 19,180원이라고 가정함 (요청에 회계팀 수치 없음)"
rejected:
  - "할인 계산(returnedDiscount)이 원인: 줄별 net은 규칙대로이고 부가세 단계에서만 어긋남"
open_questions: []
intent_deviation: null
risks:
  - "청구서(src/invoice/total.js)와 견적도 합계 반올림 방식이면 같은 문제일 수 있으나 비목표라 고치지 않음. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "반품 줄의 금액 할인 안분(returnedDiscount)은 반올림이라 규칙 해석이 다르면 별도 확인 필요"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세도 줄마다 net 원 단위 버림 합산이다. CN-0112 환불은 부가세 1,742원, 합계 19,180원 (src/invoice/credit-note.js creditTotals)"
---
## 요약
`creditTotals`가 과세 공급가액 합에 부가세를 한 번 반올림해 CN-0112가 19,182원이 나왔다. 줄마다 버림 후 합산하게 고쳐 19,180원이 된다. 테스트 2개를 추가했고 `npm test` 50개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `creditTotals` vat 계산.
- 테스트: `test/credit-note.test.js` 끝의 2개. 수정 전 실패를 확인함.
- 기준 커밋에서 `npm test` 48개 모두 통과.
- 청구서·견적·`src/format/`은 변경 없음.
