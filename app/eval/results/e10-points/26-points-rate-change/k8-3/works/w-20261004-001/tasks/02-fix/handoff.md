---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints는 earnPoints를 호출해 계산식을 한 곳으로 합친다"
    why: "두 계산이 어긋나 생긴 버그라 같은 기준을 공유하게 함"
    by: ai
  - what: "버림용 percentOfFloor를 새로 추가하고 percentOf는 그대로 둔다"
    why: "percentOf는 환불 회수 포인트에서 쓰고, 환불 규칙 변경은 비목표"
    by: ai
assumptions: []
rejected:
  - "배송비 제외 + 반올림: O-1042가 238P가 되어 237P와 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불의 pointsRecovered(src/orders/refund.js:34)는 상품 금액 × 적립률% 반올림이라 새 적립 기준과 어긋날 수 있음 (환불 규칙은 비목표라 건드리지 않음)"
  - "이미 저장된 주문의 points.earned는 그대로라 과적립이 남음 (비목표)"
  - "사용 포인트가 상품−쿠폰보다 큰 경계 사례는 assertPointUse가 막는다고 보고 따로 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 상품 − 쿠폰 − 사용 포인트(배송비 제외)의 적립률%를 원 단위 버림한다. 계산은 src/points/earn.js의 earnPoints 한 곳이며 선물하기도 이를 쓴다 (사람)"
  - "부분 환불 회수 포인트는 percentOf(반올림)를 써서 적립 기준과 다를 수 있다: src/orders/refund.js:34"
---
## 요약
적립 포인트가 배송비를 포함한 금액에 반올림을 해서 많게 나오던 것을, 배송비 제외 + 버림으로 고쳤다. O-1042는 237P, G-0213은 218P이고 `npm test` 24개가 통과한다.
## 다음 task가 알아야 할 것
- 계산: `src/points/earn.js`(`earnBase`, `earnPoints`), `src/gift/gift-points.js`는 위임, 버림 도우미는 `src/money.js`의 `percentOfFloor`
- 테스트: `test/earn.test.js` 4개. 수정 전 4개 모두 실패 확인
- 미해결: `src/orders/refund.js:34` 부분 환불 회수 포인트는 아직 반올림 방식
