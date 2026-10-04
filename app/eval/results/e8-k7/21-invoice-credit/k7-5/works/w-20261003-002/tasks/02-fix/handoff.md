---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "부가세만 줄별 버림으로 고치고, 부분 반품 금액 할인의 반올림(returnedDiscount)은 그대로 둔다"
    why: "팀 지식 docs/knowledge/vat-per-line-floor.md 규칙이 부가세만 지정하고, 할인 반올림은 규칙에 없어 범위 밖"
    by: ai
assumptions:
  - "회계팀 기대 금액이 없어 팀 규칙으로 계산한 19,180원을 기준으로 삼음"
rejected:
  - "returnedDiscount 반올림이 원인: CN-0112는 전량 반품이라 할인이 청구서와 같아 무관"
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/total.js의 computeTotals도 같은 Math.round 방식임. 범위 밖이라 안 고침. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "부분 반품의 금액 할인은 수량 비율 반올림 그대로라 줄별 규칙과 1원 차이가 날 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 과세 줄별 floor 합으로 계산하게 고쳤다. CN-0112 환불 합계는 19,182원에서 19,180원이 된다. 재현 테스트를 추가했고 `npm test`는 47개 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `creditTotals`. 테스트: `test/credit-note.test.js` 마지막 테스트.
- 저장된 `totals`는 `creditNoteTotals`가 그대로 반환(변경 없음). `src/format/` 변경 없음.
- CN-0112 기대값: supply 17438, vat 1742, total 19180.
