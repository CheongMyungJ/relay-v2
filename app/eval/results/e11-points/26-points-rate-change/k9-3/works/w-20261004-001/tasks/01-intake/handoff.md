---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "적립 기준 = (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림"
    why: "고객센터 적립 안내 기준을 사람이 직접 알려 줌. O-1042 기대값 237P"
    by: human
  - what: "선물하기 적립과 환불 포인트 회수도 같은 기준으로 맞춘다"
    why: "사람이 범위에 포함하라고 답함"
    by: human
assumptions:
  - "환불 회수의 구체적 계산 방식은 사람이 정하지 않았다. 적립 기준과 어긋나지 않게 맞추는 것으로 해석함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이미 적립·저장된 주문은 다시 계산하지 않으므로, 환불 시 회수액이 옛 적립분과 어긋날 수 있다"
recommended_next: null
knowledge_candidates:
  - "포인트 적립 기준: (상품 금액 − 쿠폰 할인 − 사용한 포인트)의 1%, 배송비 제외, 1P 미만 버림. 일반·선물 적립과 환불 회수 모두 같은 기준 (사람)"
  - "이미 적립된 포인트는 다시 계산하지 않는다 (사람)"
---
## 요약
적립 포인트가 안내보다 많게 나오는 버그의 intent 초안을 썼다. 기준은 사람이 알려 준 대로이고, 범위는 일반 주문·선물·환불 회수다.
## 다음 task가 알아야 할 것
- 코드 위치: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`, 저장은 `src/orders/order.js:35`. 반올림은 `src/money.js`의 `percentOf`.
- 참고(가설, 확인 안 됨): O-1042를 손으로 계산하면 28,270−3,000−1,500=23,770 → 237P. 현재 268P는 26,770(배송비 포함, 사용 포인트 차감)의 1%로 보임.
- 테스트: `npm test`(node --test).
