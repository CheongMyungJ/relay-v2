---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "src/gift/gift-points.js 수정을 이번 Work에서 허용한다"
    why: "팀 지식은 수정 금지(다른 팀 협의 필요)지만, 사람이 근거를 확인한 뒤 수정 허용을 직접 골랐다"
    by: human
assumptions:
  - "선물하기 적립도 일반 주문과 같은 기준((상품 금액 - 쿠폰 - 사용 포인트)의 1%, 원 미만 버림)을 쓴다. 근거는 고객센터 218P 한 건이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 팀과의 협의가 끝났는지 확인되지 않았다. 협의 대상 팀과 담당자도 레포에 없다. 사람은 이 상태로 수정을 허용했다"
  - "일반 주문 기준은 O-1042 한 건에서 역산했다. 선물하기에 같은 기준을 쓰라는 규정은 레포에 없다"
  - "부분 환불 회수(src/orders/refund.js)는 아직 반올림(percentOf)이라 기준이 다르다. 선물하기 주문을 환불하면 회수 포인트와 적립 포인트의 기준이 어긋날 수 있다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립(src/gift/gift-points.js)은 사람이 허용해 이번 Work에서 수정하기로 했다. 다른 팀과의 협의 여부는 확인되지 않았다 (사람)"
  - "고객센터가 G-0213의 적립 기준을 218P로 계산한다. 선물하기도 일반 주문과 같은 기준을 쓰는 것으로 본다 (사람)"
---
## 요약
G-0213 적립 예정이 249P로 나오는 문제를 고치는 intent 초안을 썼다. 목표는 218P다. 협의 여부가 확인되지 않은 gift-points.js 수정은 사람이 허용했다.
## 다음 task가 알아야 할 것
- 참고(내 추정, 확인 안 됨): `src/gift/gift-points.js:6`은 `percentOf(order.amounts.total, 1)`이다. total에는 배송비 3,000원이 들어 있고 반올림한다. 24,860 × 1% = 248.6 → 249P이다. 일반 주문 기준으로는 (24,860 - 2,000 - 1,000) × 1% = 218.6 → 218P이다.
- 일반 주문 기준 구현은 `src/points/earn.js`의 `earnPoints`이다. 선물하기 주문 생성은 `src/gift/gift-order.js`이고 `order.points.earned`를 `giftPoints(order)`로 채운다.
- 기존 테스트는 `test/gift.test.js`에서 30,000원 무료 배송 주문의 300P를 확인한다. `npm test`로 실행한다.
- 영수증 비교는 `node src/cli.js examples/G-0213.json`을 수정 전후로 돌려 본다.
- 참고 지식: `docs/knowledge/earn-points-rule.md`, `gift-points-do-not-touch.md`, `keep-earned-points-stored.md`, `receipt-text-unchanged.md`.
