---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄마다 할인 후 금액 floor로 계산해 합산한다"
    why: "팀 지식 docs/knowledge/vat-per-line-floor.md 규칙(반품 전표 포함)"
    by: ai
assumptions:
  - "줄별 할인 계산(returnedDiscount의 Math.round)은 바꾸지 않음. 기대 합계 19,180원과 맞음"
rejected:
  - "returnedDiscount 반올림 문제: 공급가액은 이미 맞고 부가세만 2원 차이"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: total.js와 quote.js도 합계에 Math.round를 쓰는 것으로 보이나 범위 밖이라 건드리지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 합계 반올림에서 과세 줄별 버림 합산으로 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다. 회귀 테스트를 추가했고 `npm test`는 50개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`
- 테스트: `test/credit-note.test.js` 끝의 두 테스트(CN-0112, 저장된 totals 유지)
- `src/format/`은 변경 없음
