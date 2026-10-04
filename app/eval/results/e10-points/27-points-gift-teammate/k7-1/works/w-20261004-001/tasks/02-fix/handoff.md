---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "earnPoints에서 percentOf를 쓰지 않고 Math.floor로 직접 계산한다"
    why: "money.js의 percentOf는 환불 등 다른 곳도 쓰므로 반올림 동작을 바꾸지 않는다"
    by: ai
assumptions:
  - "다른 주문이 많게 나오는 것도 배송비 포함과 반올림 때문이라고 보았다. O-1042만 안내 기준과 직접 대조했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불의 pointsRecovered(src/orders/refund.js:34)는 저장된 earned가 아니라 환불 상품 금액에 percentOf(반올림)로 다시 계산한다. 이번 범위 밖이라 두었고 적립 기준과 어긋날 수 있다"
  - "선물하기 적립(src/gift/gift-points.js)은 비목표라 수정하지 않았다. 같은 차이가 남아 있다"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 계산은 src/points/earn.js의 earnPoints이고, 선물하기(gift-points.js)와 부분 환불(refund.js:34)은 별도로 percentOf를 복제해 쓴다"
---
## 요약
일반 주문 적립을 (상품 − 쿠폰 − 사용 포인트)의 1%, 원 단위 버림으로 고쳤다. O-1042는 268P에서 237P가 된다. 재현 테스트 3개를 추가했고 npm test는 23개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`. 테스트: `test/earn.test.js`.
- 기존 테스트는 바꾸지 않았다. `src/gift/`와 `src/format/`도 바뀌지 않았다.
- `src/orders/refund.js:34` 부분 환불은 적립 포인트를 다시 계산한다. 완료조건의 "다시 계산하지 않는다"는 저장값을 쓰는 전체 취소·영수증 경로에 해당하고, 부분 환불은 원래부터 재계산이라 그대로 두었다.
