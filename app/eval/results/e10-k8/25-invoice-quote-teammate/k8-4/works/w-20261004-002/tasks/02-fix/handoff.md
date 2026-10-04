---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄마다 Math.floor로 계산해 합산"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md 규칙과 intent 제약"
    by: ai
assumptions:
  - "회계팀 기준 금액은 줄별 버림 규칙 값(CN-0112 환불 합계 19,180원)이라고 가정함"
rejected:
  - "returnedDiscount 안분 반올림 오류: CN-0112에서는 안분 반올림이 개입하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "회계팀의 실제 CN-0112 금액을 확인하지 못함. 19,180원과 다르면 확인 필요"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 청구서 computeTotals(src/invoice/total.js)는 아직 합계 기준 Math.round이며 이번 범위 밖이라 건드리지 않음"
  - "부분 반품 시 비율 할인은 반품 줄 기준 반올림, 금액 할인은 수량 안분 반올림이라 청구서 줄 할인과 1원 차이날 수 있음(미확인)"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세도 과세 줄마다 원 단위 버림 후 합산한다. src/invoice/credit-note.js creditTotals에 적용됨 (규칙은 vat-per-line-floor.md, 이 항목의 '아직 따르지 않는 곳'에서 반품 전표는 해결됨)"
---
## 요약
반품 전표 부가세가 합계 기준 Math.round라 CN-0112가 19,182원으로 나오던 것을, 줄별 버림 합산으로 고쳐 19,180원이 되게 했다. 재현 테스트를 추가했고 npm test 50개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`의 vat 계산
- CN-0112 기대: supply 17,438, vat 1,742(923+612+207), total 19,180
- 저장된 `totals`는 `creditNoteTotals`가 그대로 반환(변경 없음), `src/format/` 미변경
- 견적(quote.js)과 청구서 computeTotals는 건드리지 않음
