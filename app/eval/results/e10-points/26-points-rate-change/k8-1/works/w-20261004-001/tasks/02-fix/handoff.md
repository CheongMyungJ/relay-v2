---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립(`giftPoints`)도 같은 규정으로 고치고 `earnPoints`에 위임한다"
    why: "intent 추가 의견에서 같은 계산을 쓰는 경로 확인을 요청했고, 같은 식이 복사되어 있었다. 적립액 계산 변경의 범위 안이다"
    by: ai
  - what: "부분 환불 회수(`refund.js:34`)는 바꾸지 않는다"
    why: "비목표: 환불 회수 규칙 변경 제외"
    by: ai
assumptions:
  - "선물하기 주문의 적립도 같은 규정을 따른다고 본다 (사람에게 확인 안 함)"
rejected:
  - "적립률 1% 설정 문제: 비목표이고 값이 규정과 같음"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수액은 `percentOf(refundGoods, 1%)`로 상품 금액 기준 반올림이라, 새 적립액(쿠폰·포인트 차감, 버림)과 다를 수 있다. 비목표라 손대지 않았다"
  - "전체 취소는 저장된 적립액을 회수하므로 이미 저장된 옛 주문은 옛 적립액 그대로다"
recommended_next: null
knowledge_candidates:
  - "적립 로직은 `src/points/earn.js`의 `earnPoints` 한 곳이고, 선물하기(`giftPoints`)는 여기에 위임한다. 규정을 바꾸면 이 함수를 고친다"
  - "부분 환불 회수액(`src/orders/refund.js`)은 적립 규정과 별도 식(상품 금액 × 1% 반올림)이라 적립 규정과 어긋날 수 있다"
---
## 요약
적립 기준을 결제 금액에서 (상품 − 쿠폰 − 사용 포인트)로 바꾸고 1P 미만을 버리게 고쳤다. O-1042는 237P가 되었다. 선물하기도 같은 함수를 쓰게 했다. 테스트 25개가 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: 새 적립 식. `src/gift/gift-points.js`는 위임.
- 새 테스트: `test/earn.test.js` (5개).
- 확인 명령: `node src/cli.js examples/O-1042.json` → 237P, `npm test` → 25 pass.
- 남은 위험: `src/orders/refund.js:34` 부분 환불 회수식이 적립 규정과 다름 (비목표).
