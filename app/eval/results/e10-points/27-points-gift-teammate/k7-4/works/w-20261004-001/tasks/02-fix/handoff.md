---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "포인트 사용액은 assertPointUse가 (상품 금액 - 쿠폰)을 넘지 못하게 막으므로 적립 기준 금액은 음수가 되지 않는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/gift/gift-points.js와 src/orders/refund.js:34(부분 환불 회수)는 여전히 옛 방식(반올림)이라 새 적립 규칙과 어긋날 수 있다. 비목표라 손대지 않았다"
  - "이미 저장된 points.earned는 바꾸지 않아, 이전 주문과 새 주문의 계산 기준이 다르다"
recommended_next: null
knowledge_candidates:
  - "적립 계산은 src/points/earn.js에 있다. 선물하기(src/gift/gift-points.js)와 부분 환불 회수(src/orders/refund.js:34)는 같은 식을 따로 복사해 쓰므로 적립 규칙을 바꿀 때 함께 확인해야 한다"
---
## 요약
적립 계산이 배송비 포함 결제 금액을 반올림하던 것을, (상품 - 쿠폰 - 사용 포인트)의 1% 버림으로 고쳤다. O-1042는 268P에서 237P가 된다. 테스트 3개를 추가했고 `npm test` 23개가 통과한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: 수정한 함수. `src/format/`, `src/gift/gift-points.js`는 변경하지 않았다.
- `test/earn.test.js`: 재현 테스트(수정 전 3개 모두 실패).
- 부분 환불 회수(`src/orders/refund.js:34`)와 선물하기 적립은 옛 방식 그대로다.
