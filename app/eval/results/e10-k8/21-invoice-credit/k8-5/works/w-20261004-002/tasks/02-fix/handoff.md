---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 줄마다 Math.floor 후 합산하도록 고쳤다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md의 규칙과 intent의 완료조건"
    by: ai
assumptions:
  - "회계팀이 기대하는 환불 합계는 줄별 버림 방식으로 계산한 19,180원이라고 본다 (요청에 금액이 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "computeTotals(src/invoice/total.js)는 비목표라 합계 기준 Math.round를 그대로 둔다. 팀 지식은 청구서도 줄별 버림이라고 하므로 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "이미 저장된 반품 전표의 totals는 소급하지 않는다"
recommended_next: null
knowledge_candidates:
  - "반품 전표(creditTotals)의 부가세도 청구서처럼 줄마다 원 단위 버림 후 합산한다. 수정 위치는 src/invoice/credit-note.js, CN-0112 기대값은 vat 1,742 / total 19,180"
---
## 요약
`creditTotals`의 부가세를 합계 기준 반올림에서 줄별 버림 합산으로 바꿨다. CN-0112 환불 합계는 19,182원에서 19,180원이 됐다. 테스트 2개를 추가했고 `npm test`는 48개 모두 통과한다. 커밋은 cfc8e96이다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `creditTotals`. 테스트는 `test/credit-note.test.js` 끝에 추가했다.
- 기존 테스트는 바꾸지 않았다. 수정 전에는 새 CN-0112 테스트만 실패했다.
- `returnedDiscount`와 `computeTotals`는 건드리지 않았다.
