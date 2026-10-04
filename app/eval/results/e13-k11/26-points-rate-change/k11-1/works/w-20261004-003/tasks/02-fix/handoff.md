---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준 금액을 배송비 제외(상품−쿠폰−사용 포인트), 원 단위 버림으로 구현한다"
    why: "docs/knowledge/points/earn-points-rule.md 규칙이고 완료조건 O-1107=486P가 이를 요구함"
    by: ai
  - what: "부분 환불 회수를 원 적립 − 남은 상품 재계산 적립으로 구현한다"
    why: "docs/knowledge/points/refund-points-recovery.md 와 intent 제약. 단순히 률만 바꾸면 규칙과 어긋남"
    by: ai
assumptions:
  - "기존 테스트의 적립 기대값은 저장 fixture 포함 2% 기준으로만 바꾸고 receipt 테스트의 저장 값 290P는 그대로 둠"
rejected:
  - "상수만 2로 변경: O-1107이 546P가 되어 완료조건 486P 불충족"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001, -002)에서 earn.js·refund.js를 같은 방향으로 고쳤을 수 있음, 머지 대기. 머지 시 충돌 가능"
  - "기존 테스트 3개 파일 기대값 변경(order, gift, refund). 약화 여부는 verify 판단"
  - "examples/R-0311.json 환불 CLI(--order O-1077)는 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "기본 적립률 POINT_RATE_PERCENT는 2%로 올렸다. 새 주문에만 적용하고 저장된 포인트는 다시 계산하지 않는다 (2026-10-04, Work w-20261004-003)"
---
## 요약
적립률을 2%로 올리고, 적립 계산을 배송비 제외·버림 기준으로 맞췄다. 선물하기와 부분 환불 회수도 같은 계산을 쓴다. O-1107은 486P이고 `npm test` 24개가 통과한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`의 `earnBase`, `earnFromBase`, `earnPoints`. 환불은 `src/orders/refund.js`의 `pointsRecovered`.
- 재현 테스트: `test/points-rate.test.js`
- `src/format/` 변경 없음. `npm test`로 확인.
