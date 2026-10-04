---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불의 포인트 회수도 소수점 버림(earnOn)으로 바꾼다"
    why: "intent의 원하는 결과: 환불 회수가 같은 계산에서 어긋나지 않아야 함. 반올림하면 적립보다 많이 회수될 수 있음"
    by: ai
  - what: "선물하기 적립은 earnPoints를 그대로 재사용한다"
    why: "intent: 선물하기 적립도 같은 기준. 계산 중복을 없앰"
    by: ai
assumptions:
  - "부분 환불 회수 기준 금액은 환불 상품 금액(쿠폰, 사용 포인트 안분 없음)을 유지함. 기존 동작이고 수정 범위 밖"
  - "G-0213 예시는 218P가 됨. 안내 값은 확인하지 못함"
rejected:
  - "적립률 변경: 비목표이고 차이는 배송비 포함과 반올림으로 모두 설명됨"
open_questions: []
intent_deviation: null
risks:
  - "기준(배송비 제외, 버림)은 O-1042 한 건에서 추정한 것. 사람이 확인함"
  - "부분 환불은 쿠폰과 사용 포인트를 안분하지 않아 환불 회수 합계가 적립보다 클 수 있는지는 확인하지 않음"
  - "이미 저장된 주문의 적립값은 소급 수정하지 않음(비목표)"
recommended_next: null
knowledge_candidates:
  - "적립 포인트 계산은 src/points/earn.js의 earnOn/earnPoints 한 곳에 둔다. 주문, 선물하기, 부분 환불 회수가 모두 이를 쓴다"
---
## 요약
적립을 배송비 제외(상품 − 쿠폰 − 사용 포인트) 금액의 1%, 소수점 버림으로 고쳤다. O-1042는 237P, O-1107은 243P, O-1077은 403P다. 선물하기와 부분 환불 회수도 같은 기준을 쓴다. `npm test` 25개 통과.
## 다음 task가 알아야 할 것
- 커밋 152745b. `src/points/earn.js`의 `earnOn`, `earnPoints`; `src/money.js`의 `percentFloor`.
- `src/orders/refund.js`의 회수는 `earnOn(refundGoods)`. 영수증과 전체 취소는 저장된 `points.earned`를 쓴다.
- 새 테스트는 order, gift, refund 테스트에 있고 수정 전에 4건 실패를 확인했다.
- `node src/cli.js examples/O-1042.json`으로 확인할 수 있다.
