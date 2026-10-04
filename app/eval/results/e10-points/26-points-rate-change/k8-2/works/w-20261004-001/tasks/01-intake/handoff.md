---
status: "awaiting_approval"
blocked_reason:
decisions: []
assumptions:
  - "고객센터의 적립 안내 기준은 요청의 예시 한 건(O-1042 = 237P)으로만 알 수 있어, 완료조건을 그 예시와 같은 기준으로 썼다"
  - "과거 주문의 적립 포인트 소급 수정과 적립률 값 변경은 비목표로 두었다"
  - "선물하기·환불 회수는 같은 적립값을 쓰므로 모순 여부만 확인 대상으로 넣었다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립 안내의 정식 기준 문서가 레포에 없다. 237P가 어떤 기준에서 나오는지는 fix가 확인해야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
O-1042의 적립 예정 포인트가 268P로 나오는데 안내 기준은 237P라는 버그 수정 의도 초안을 썼다. 코드는 바꾸지 않았다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`의 `earnPoints`는 `order.amounts.total`에 `POINT_RATE_PERCENT`(`src/config.js`, 1%)를 곱한다.
- 테스트: `npm test`(`node --test`). 입력 예시는 `examples/O-1042.json`.
- 참고(가설, 확인 안 됨): O-1042는 상품 28,270원, 쿠폰 3,000원, 포인트 1,500P로 쿠폰·포인트 차감 후 23,770원이고, 237P는 그 1%, 268P는 배송비 3,000원이 붙은 26,770원의 1%와 맞는다. fix가 실제 원인을 확인할 것.
- 같은 적립값을 쓰는 곳: `src/gift/gift-points.js`, `src/orders/refund.js`, `src/points/ledger.js`, `src/format/receipt.js`.
