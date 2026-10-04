---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수를 '환불 전 남은 주문 적립액 − 환불 후 남은 주문 적립액'으로 계산한다. 쿠폰·사용 포인트는 남은 주문에 그대로 둔다"
    why: "합계가 저장된 적립액 이하이고 적립 규정과 맞아야 한다는 intent. 입력 형식(alreadyRefunded)을 바꾸지 않고 합이 이어지게 하는 방법"
    by: ai
  - what: "일반 주문과 선물하기가 같은 earnPoints 규정을 쓰게 했다"
    why: "intent 완료조건: 선물하기도 같은 규정"
    by: ai
assumptions:
  - "남은 주문 적립액은 저장된 적립액을 넘지 않게 제한했다. 옛 규정으로 저장된 주문에서도 합계가 저장된 적립액 이하다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "R-0311(O-1077) 회수가 131P에서 132P로 바뀐다. 남은 주문 적립액(271P)을 저장된 403P에서 뺀 값이라 규정과 맞는다"
  - "회수 건별 값은 환불 순서와 무관하게 상태로 정해지지만, alreadyRefunded 입력이 틀리면 회수도 틀어진다"
recommended_next: null
knowledge_candidates:
  - "적립 규정: 상품 금액에서 쿠폰 할인과 사용 포인트를 뺀 금액의 1%, 배송비 제외, 1P 미만 버림 (사람)"
  - "부분 환불 회수 합계는 저장된 적립액을 넘지 않고 적립 규정과 맞아야 한다. 이미 저장된 적립액은 재계산하지 않는다 (사람)"
  - "적립 계산은 src/points/earn.js의 earnBase/earnOn 한 곳에서 한다. 선물하기와 환불 회수도 이것을 쓴다"
---
## 요약
적립을 상품−쿠폰−사용 포인트의 1% 버림으로 고쳤다. O-1042는 237P, G-0213은 218P다. 부분 환불 회수는 남은 주문 적립액의 차이로 계산해 합계가 저장된 적립액을 넘지 않는다. 테스트 6건을 추가했고 `npm test`는 27건 통과다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnBase`, `earnOn`, `earnPoints`
- `src/orders/refund.js:31`: `keep()`으로 회수 계산, 입력 형식 변경 없음
- `test/earn.test.js`: 새 테스트. 기존 테스트는 바꾸지 않았다
- `src/format`과 저장된 `points.earned`는 건드리지 않았다
- R-0311 결과가 -131P에서 -132P로 바뀐다
