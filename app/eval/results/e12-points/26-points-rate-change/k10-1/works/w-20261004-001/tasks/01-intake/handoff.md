---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 (상품 금액 − 쿠폰 − 사용 포인트) × 1%, 배송비 제외, 1P 미만 버림"
    why: "사람이 O-1042의 237P가 맞다며 규정으로 알려 줌"
    by: human
  - what: "선물하기 적립과 환불 회수 포인트도 같은 기준으로 맞춘다"
    why: "사람이 선물·환불 모두 포함하라고 답함"
    by: human
assumptions:
  - "부분 환불 회수 포인트의 구체적 기준(상품 금액 비례 시 버림 적용 등)은 같은 규정을 따른다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불은 쿠폰·사용 포인트가 남은 주문에 남는 구조라, 회수 포인트를 어떤 금액에 적용할지 fix에서 확인이 필요함"
  - "전체 취소는 저장된 points.earned를 그대로 회수하므로 이미 많이 적립된 기존 주문은 바뀌지 않음(의도된 동작)"
recommended_next: null
knowledge_candidates:
  - "포인트 적립 규정: 상품 금액에서 쿠폰 할인과 사용 포인트를 뺀 금액의 1%, 배송비 제외, 1P 미만 버림(반올림 아님). 일반·선물·환불 회수 모두 적용 (사람)"
  - "이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다. 영수증 글자(src/format/)는 바뀌면 안 된다 (사람)"
---
## 요약
적립 포인트를 배송비 제외, 쿠폰·사용 포인트 차감 후 1% 버림으로 계산하도록 고치는 의도를 정리했다. 일반·선물·환불 모두 범위다.
## 다음 task가 알아야 할 것
- 현재 적립: `src/points/earn.js:6`, `src/gift/gift-points.js:6`이 `order.amounts.total`(배송비 포함, 포인트 차감 후)에 `percentOf`(반올림) 적용. 환불은 `src/orders/refund.js:34`.
- `src/money.js` `percentOf`는 반올림. 다른 곳에서도 쓰일 수 있으니 공용 함수를 바꿀 때 주의.
- 주문 생성 `src/orders/order.js:35`에서 `earned` 저장. 테스트: `npm test`(node --test).
- O-1042: goods 28,270 − 쿠폰 3,000 + 배송 3,000 − 포인트 1,500 = total 26,770 → 현재 268P, 기대 237P.
