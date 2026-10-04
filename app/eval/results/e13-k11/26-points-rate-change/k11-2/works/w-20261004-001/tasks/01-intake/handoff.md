---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "적립 안내의 기준은 요청에 적힌 고객센터 계산값(O-1042 = 237P)이다. 안내 원문은 레포에서 찾지 못했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 주문에서 '조금씩 많게' 나오는 정도는 확인하지 않았다. 적립 기준 규칙이 안내 원문과 같은지는 fix에서 확인이 필요하다"
recommended_next: null
knowledge_candidates: []
---
## 요약
O-1042 적립 예정 포인트가 안내(237P)보다 많게(268P) 나오는 버그의 의도를 정리했다. 원인은 쓰지 않았다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnPoints`가 `order.amounts.total`에 `POINT_RATE_PERCENT`(`src/config.js`, 1%)를 적용한다.
- 주문 금액은 `src/orders/order.js`의 `orderAmounts`, 적립은 `createOrder`에서 저장한다.
- 테스트 명령: `npm test`. 재현: `node src/cli.js examples/O-1042.json`.
- 참고(가설): O-1042의 상품 28,270원, 쿠폰 3,000원, 배송비 3,000원, 사용 포인트 1,500원이다. 237P는 23,770원의 1%와 맞는다.
