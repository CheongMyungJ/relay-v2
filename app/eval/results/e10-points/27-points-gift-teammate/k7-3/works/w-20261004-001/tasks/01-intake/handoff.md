---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "테스트 명령은 package.json의 `npm test`(node --test)로 가정했다"
  - "다른 주문도 많게 나온다는 말은 같은 원인의 계산 문제로 보고 범위를 적립 계산으로 잡았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "고객센터 계산 규칙의 전체 설명이 요청에 없다. O-1042 한 건의 기대값 237P만 확인 기준이다"
recommended_next: null
knowledge_candidates:
  - "이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 그대로 쓴다 (사람)"
  - "영수증 글자(src/format/)는 바뀌면 안 된다 (사람)"
  - "선물하기 적립(src/gift/gift-points.js)은 다른 팀과 같이 보고 있어 손대지 않는다 (사람)"
---
## 요약
적립 포인트가 많게 나오는 버그의 의도 초안을 썼다. 비목표는 선물하기 적립, 영수증 글자, 이미 적립된 포인트 재계산이다. 완료조건에는 O-1042가 237P로 나오는 것을 넣었다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`, `percentOf(order.amounts.total, POINT_RATE_PERCENT)`
- 주문 데이터: `examples/O-1042.json` (상품 17,800 + 10,470, 쿠폰 3,000, 사용 포인트 1,500)
- 참고용 가설(확인 안 됨): 237P는 (상품합 - 쿠폰 - 사용 포인트) x 1%와 맞고, 268P는 사용 포인트를 빼지 않은 금액의 1%와 가깝다. `order.amounts.total` 계산은 `src/orders/order.js`에서 확인해야 한다.
- 실행: `npm test`
