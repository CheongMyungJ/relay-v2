---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수 포인트 = 환불 전 남은 주문 적립분 − 환불 뒤 남은 주문 적립분 (쿠폰·사용 포인트는 남은 주문에 그대로)"
    why: "환불이 쿠폰·사용 포인트를 남은 주문에 두므로, 적립과 같은 식을 남은 금액에 적용해 차이를 회수해야 여러 번 환불해도 합이 어긋나지 않음"
    by: ai
assumptions:
  - "저장된 points.earned는 새 규칙으로 계산된 값이라고 가정(과거 주문은 소급하지 않음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이미 268P 등 옛 규칙으로 저장된 주문을 부분 환불하면 회수량이 저장된 적립과 맞지 않을 수 있음(소급 비목표)"
  - "기존 테스트는 변경하지 않음. 새 테스트 중 무료 배송 케이스는 수정 전에도 통과(회귀 방지용)"
recommended_next: null
knowledge_candidates:
  - "부분 환불은 쿠폰·사용 포인트를 남은 주문에 두고, 회수 포인트는 환불 전후 남은 주문의 적립분 차이로 계산한다 (src/orders/refund.js)"
---
## 요약
적립 기준을 배송비 제외(상품 − 쿠폰 − 사용 포인트)로, 계산을 버림으로 바꿨다. 일반·선물 적립과 부분 환불 회수가 같은 식을 쓴다. O-1042는 237P, `npm test` 26개 통과.
## 다음 task가 알아야 할 것
- 공통 식: `src/points/earn.js`의 `earnBase`, `earnOn`
- 환불 회수: `src/orders/refund.js` (전후 적립분 차이)
- 새 테스트: `test/earn-rule.test.js`
- 수정 전 코드에서 새 테스트 5개 실패 확인
