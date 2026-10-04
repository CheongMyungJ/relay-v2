---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수 포인트는 환불 상품 금액의 1% 버림으로 한다"
    why: "쿠폰·사용 포인트는 남은 주문에 남으므로 환불 상품 금액만큼 적립 기준이 줄어든다. 버림이라 회수 합계가 적립을 넘지 않는다"
    by: ai
  - what: "`percentOf`는 두고 버림용 `floorPercentOf`를 추가"
    why: "공용 함수의 다른 사용처 영향을 피함"
    by: ai
assumptions:
  - "부분 환불 회수는 환불 상품 금액 × 1% 버림이 규정에 맞다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "intent 원하는 결과의 '상품 25,270원'은 실제 28,270원이다(쿠폰 3,000 포함). 237P 결과는 같다"
  - "기존에 반올림으로 저장된 주문의 부분 환불은 저장된 earned를 넘겨 회수하지 않지만 상한 검사는 넣지 않음"
recommended_next: null
knowledge_candidates:
  - "적립 기준은 `earnBase`(src/points/earn.js): 상품 − 쿠폰 − 사용 포인트, 배송비 제외, `floorPercentOf`로 버림. 선물·부분 환불도 이 기준 (사람)"
---
## 요약
적립을 배송비 제외, 쿠폰·사용 포인트 차감 후 1% 버림으로 고쳤다. 일반·선물·부분 환불이 같은 기준이다. O-1042는 237P다. `npm test` 24건 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js` `earnBase`/`earnPoints`, `src/money.js` `floorPercentOf`, `src/orders/refund.js:34`
- 테스트: `test/earn.test.js`
- 전체 취소와 `src/format/`은 변경 없음
