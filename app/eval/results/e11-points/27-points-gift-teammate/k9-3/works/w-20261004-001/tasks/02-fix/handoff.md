---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비를 뺀 금액으로 하고 원 미만은 버린다"
    why: "기대값 237P(사람이 확정)는 23770원의 1%인 237.7을 버림해야만 나온다. 반올림이면 238P"
    by: ai
  - what: "`percentOf`는 바꾸지 않고 `earn.js`에서만 버림 처리한다"
    why: "`percentOf`는 환불 회수(`src/orders/refund.js:34`)에서도 쓰고, 범위가 넓어지는 것을 피함"
    by: ai
assumptions:
  - "고객센터 계산 기준은 문서가 없어 O-1042의 237P에서 역산함(배송비 제외, 버림)"
rejected:
  - "적립률 설정 오류: POINT_RATE_PERCENT는 1%로 정상"
open_questions: []
intent_deviation: null
risks:
  - "배송비만 빼고 반올림하면 238P라 버림이 필요한데, 버림 규칙은 한 건(O-1042)으로만 확인됨"
  - "부분 환불 회수 포인트는 `percentOf`(반올림)를 써서 적립 방식과 달라질 수 있음. 범위 밖이라 두었다"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 포인트는 배송비를 뺀 결제 금액의 1%이고 원 미만은 버린다 (O-1042 237P 기준)"
---
## 요약
적립 예정 포인트가 배송비를 포함한 금액을 반올림해 268P로 나오던 것을, 배송비를 빼고 버림해 237P가 되게 고쳤다. 재현 테스트를 추가했고 `npm test`는 22개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js` (`total - shipping`, `Math.floor`)
- 테스트: `test/earn.test.js`
- 선물하기(`src/gift/gift-points.js`)는 같은 식을 쓰지만 비목표라 그대로 둠
- 부분 환불 회수 `src/orders/refund.js:34`는 반올림을 씀
