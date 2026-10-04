---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "부분 환불 회수 포인트는 환불 전후 기준 금액의 적립 포인트 차이로 계산한다"
    why: "각 환불에 따로 1% 버림을 하면 합이 전체 적립과 어긋난다. 차이 방식은 합이 맞고, 쿠폰·사용 포인트는 남은 주문에 남는다는 기존 규칙과 일치한다"
    by: ai
  - what: "선물 적립은 `earnPoints`를 그대로 호출한다"
    why: "intent: 주문과 같은 기준"
    by: ai
assumptions:
  - "고객센터 규칙은 O-1042 한 건에서 역산한 것이라 다른 주문으로는 확인하지 않음(intake에서 이어짐)"
  - "부분 환불 회수의 계산 방식(전후 차이)은 intent에 적혀 있지 않아 위처럼 정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "과거 주문(옛 기준으로 저장된 `points.earned`)을 부분 환불하면 새 기준으로 계산한 회수 값이 저장 적립과 어긋날 수 있다. 전체 취소는 저장값을 그대로 회수한다"
  - "`examples/O-1077.json`의 저장 적립 403P는 새 기준과 같지만 부분 환불 회수는 131P에서 132P로 바뀐다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 뺀 금액(상품 − 쿠폰 − 사용 포인트)의 1%를 원 단위로 버림한다. 주문·선물 적립과 환불 회수가 모두 `src/points/earn.js`의 기준을 쓴다 (사람)"
  - "부분 환불 회수 포인트는 환불 전과 후 기준 금액의 적립 포인트 차이로 계산한다(`src/orders/refund.js`)"
---
## 요약
적립 기준을 배송비 제외, 1% 버림으로 바꿨다. O-1042는 268P에서 237P가 된다. 선물 적립과 환불 회수도 같은 기준을 쓴다. `npm test` 27개 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnBase`, `pointsForBase`, `earnPoints`. `src/money.js`: `floorPercentOf` 추가(`percentOf`는 다른 곳에서 안 쓰게 됨).
- `src/orders/refund.js:34`: 회수 = 환불 전 적립 − 환불 후 적립.
- 새 테스트: `test/earn.test.js`. 수정 전 5개 실패, 수정 뒤 모두 통과.
- 확인 명령: `node src/cli.js examples/O-1042.json` → 237P.
