---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 상품 금액-쿠폰-사용 포인트(배송비 제외)로 하고 1P 미만은 내림한다"
    why: "O-1042가 237P가 되는 유일한 계산이다 (23,770원 × 1% = 237.7 → 237)"
    by: ai
  - what: "선물하기 적립(giftPoints)도 같은 기준으로 맞춘다"
    why: "intent: 저장되는 적립 값이 고쳐진 값을 따라야 하고, 선물 주문 금액 계산은 일반 주문과 같다"
    by: ai
assumptions:
  - "적립 안내 원문이 없어 고객센터 계산값(237P)에서 규칙(배송비 제외, 사용 포인트 차감, 내림)을 역산했다"
rejected:
  - "적립률 변경: 비목표이고 1%가 237P와 맞는다"
  - "반올림 유지: 기준만 고치면 238P가 되어 237P와 맞지 않는다"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수(`src/orders/refund.js`의 `percentOf(refundGoods, ...)`)는 반올림이고 쿠폰·사용 포인트를 반영하지 않아 새 적립 규칙과 어긋날 수 있다. 환불은 이번 범위 밖이라 건드리지 않음"
  - "`examples/O-1077.json`에 저장된 earned 403은 새 규칙과 같아 영향 없음"
recommended_next: null
knowledge_candidates:
  - "적립 규칙: 적립 기준은 상품 금액-쿠폰-사용 포인트(배송비 제외), 1P 미만 내림. 고객센터 계산값 O-1042=237P에서 역산 (사람 요청 기준)"
  - "적립 계산 위치: `src/points/earn.js`의 `earnPoints`, 선물하기는 `src/gift/gift-points.js`가 이를 재사용. 부분 환불 회수는 `src/orders/refund.js`에서 따로 계산해 규칙이 어긋남"
---
## 요약
적립 기준이 배송비 포함 결제 금액 + 반올림이던 것을 상품 금액-쿠폰-사용 포인트 + 내림으로 고쳤다. O-1042가 268P에서 237P가 됐다. `npm test` 26개 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnBase`, `earnPoints`(내림). `src/gift/gift-points.js`는 `earnPoints` 재사용.
- 새 테스트 `test/earn.test.js`. 수정 전에는 4건 실패.
- 예: O-1107 243P, G-0213 218P.
- 부분 환불 회수(`refund.js:36`)는 새 규칙과 다름(반올림, 쿠폰·포인트 미반영). 범위 밖으로 뒀다.
