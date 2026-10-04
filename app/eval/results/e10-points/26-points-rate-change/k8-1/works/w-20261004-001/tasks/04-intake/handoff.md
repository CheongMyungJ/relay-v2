---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수를 intent 범위에 포함하고, 환불 회수 규칙 변경 비목표는 '적립 규정과의 일치·상한' 부분만 풀었다"
    why: "사람 추가 지시: 회수 합계가 저장된 적립액을 넘지 않고 새 규정과 맞게"
    by: human
  - what: "이미 저장된 적립액 재계산 금지, src/format 영수증 글자 유지를 비목표와 제약에 넣었다"
    why: "사람 추가 지시"
    by: human
assumptions:
  - "여러 번 부분 환불할 때 쿠폰·사용 포인트를 환불 건 사이에 어떻게 나눌지는 정하지 않았다. 완료조건은 '합계가 저장된 적립액 이하'와 '새 규정과 일치'만 요구한다. 배분 방식은 fix가 정한다."
  - "선물하기 적립도 같은 규정을 따른다고 보고 완료조건에 넣었다 (이전 시도에서 같은 함수를 쓰게 했음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "환불 입력(alreadyRefunded)에 이전 회수 포인트가 없어 누적 회수 상한을 계산하는 방법이 설계 사항이다. 입력 형식을 바꾸면 영수증과 CLI에 영향이 갈 수 있다."
recommended_next: null
knowledge_candidates:
  - "적립 규정: 상품 금액에서 쿠폰 할인과 사용 포인트를 뺀 금액의 1%를 적립, 배송비 제외, 1P 미만 버림 (사람)"
  - "부분 환불 회수 합계는 저장된 적립액을 넘지 않아야 하고 새 적립 규정과 맞아야 한다. 이미 적립된 값은 재계산하지 않는다 (사람)"
---
## 요약
이전 intent에 부분 환불 회수를 포함해 다시 정리했다. 회수 합계가 저장된 적립액 이하이고 새 적립 규정과 맞아야 한다. 저장된 적립액 재계산 금지와 src/format 유지를 비목표와 제약에 넣고 완료조건 4개를 더했다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34`: 부분 환불 회수가 `percentOf(refundGoods, POINT_RATE_PERCENT)`로 환불 상품 금액만 쓴다. 쿠폰과 사용 포인트는 반영하지 않는다.
- `src/orders/refund.js:42`: 전체 취소는 `order.points.earned` 전부를 회수한다.
- `src/orders/refund.js:12`: `alreadyRefunded`는 sku와 qty만 가진다. 이전 회수 포인트는 입력에 없다.
- `src/orders/order.js:35`, `src/gift/gift-order.js:36`: 적립액을 저장하는 곳이다.
- 예시 `examples/R-0311.json`(주문 O-1077), 테스트 `test/refund.test.js`. 테스트 명령은 `npm test`.
- 이 단계에서는 코드를 바꾸지 않았다.
