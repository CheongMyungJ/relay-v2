---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "고객센터 기준 237P를 정답으로 본다. 계산 기준(어떤 금액에 몇 %)은 fix에서 코드와 O-1042로 확인한다"
  - "테스트 명령은 package.json의 `npm test` (node --test)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 주문에서 얼마나 많게 나오는지는 확인된 사례가 없다"
  - "src/gift/gift-points.js가 earn.js를 같이 쓰면 이번 수정이 선물 적립에 번질 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
적립 포인트 과다 계산 버그의 의도 초안을 썼다. 비목표는 기적립 값 재계산, 영수증 글자, 선물하기 적립이다.
## 다음 task가 알아야 할 것
- 대상: `src/points/earn.js`의 `earnPoints`가 `order.amounts.total`에 `POINT_RATE_PERCENT`를 곱한다 (`src/config.js`, `src/money.js`의 `percentOf`).
- 예시 주문: `examples/O-1042.json` (상품 17,800 + 10,470, 쿠폰 3,000, 포인트 사용 1,500). 현재 268P, 기대 237P.
- 원인은 아직 보지 않았다. `src/orders/order.js`의 amounts 계산과 비교해 볼 것.
- 테스트: `npm test`
