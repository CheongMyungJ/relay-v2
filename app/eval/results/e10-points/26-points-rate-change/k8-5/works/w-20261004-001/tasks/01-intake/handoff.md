---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "비목표 추가: 이미 적립된 포인트는 다시 계산하지 않고 저장된 값을 쓴다. 영수증 글자(src/format/)는 바꾸지 않는다"
    why: "사람 요청: 앱과 메일이 영수증을 그대로 보여 준다"
    by: human
assumptions:
  - "고객센터 계산 기준은 요청에 적힌 237P(O-1042)만 알고 있다. 다른 주문의 기대값은 같은 기준으로 맞춘다고 가정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "고객센터 계산의 정확한 규칙(적립 대상 금액, 소수점 처리)이 문서로 확인되지 않았다"
  - "같은 계산이 src/gift/gift-points.js와 src/orders/refund.js(pointsRecovered)에도 있어 같은 문제가 있을 수 있다. 범위에 넣을지는 fix에서 확인이 필요하다"
recommended_next: null
knowledge_candidates:
  - "이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값(points.earned)을 그대로 쓴다 (사람)"
  - "영수증 글자(src/format/)는 앱과 메일이 그대로 보여 주므로 바뀌면 안 된다 (사람)"
---
## 요약
O-1042 적립 예정 포인트가 268P로 나오고 고객센터는 237P라는 버그 수정 의도를 정리했다. 원인은 조사하지 않았다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js:6`, 호출은 `src/orders/order.js:35`. 적립률은 `src/config.js`의 `POINT_RATE_PERCENT`(1)
- 비슷한 계산: `src/gift/gift-points.js:6`, `src/orders/refund.js:34`
- 참고용 관찰(확인 안 됨): O-1042는 상품 28,270원 - 쿠폰 3,000 + 배송비 3,000 - 포인트 1,500 = 26,770원이고, 1%면 268P. 배송비를 뺀 23,770원의 1%는 237.7이라 237P와 맞는다
- 테스트: `npm test` (node --test), 예시 주문은 `examples/`
