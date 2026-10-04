---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 줄마다 버림 후 합산으로 고친다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md"
    by: ai
assumptions:
  - "CN-0112의 회계팀 수치는 줄별 버림 값 19,180원일 것이다"
rejected:
  - "returnedDiscount 수량비 반올림이 원인: CN-0112는 금액 할인 줄을 전량 반품해 영향 없음"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 creditTotals를 이미 고쳤을 수 있음, 머지 대기. 머지 시 충돌 가능"
  - "이미 발행된 반품 전표의 저장된 totals는 재계산하지 않음(비목표)"
  - "computeTotals(청구서)는 여전히 합계 반올림이지만 비목표라 건드리지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
`creditTotals`의 부가세를 합계 반올림에서 과세 줄별 버림 합산으로 고쳤다. CN-0112 환불 합계는 19,182원에서 19,180원이 된다. 재현 테스트를 추가했고 `npm test` 48개가 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: vat 계산 변경
- 테스트: `test/credit-note.test.js` 끝의 테스트 2개
- 재현: INV-2047 + CN-0112 → vat 1,742 / total 19,180
