---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 = 저장된 원래 적립 포인트 − 남은 상품 기준 재계산 적립(쿠폰·사용 포인트 반영, 배송비 제외, 1P 미만 버림)"
    why: "사람이 정산팀 방식이라고 답함. O-1077은 403−271=132P로 정산팀 값과 일치"
    by: human
assumptions:
  - "이전 환불(alreadyRefunded)이 있으면 남은 상품 금액에서도 그만큼 뺀다고 가정(코드의 remainingGoods 계산과 같은 방식)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/gift/gift-points.js 등 다른 반올림 코드는 범위 밖. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "부분 환불 포인트 회수 = 주문에 저장된 원래 적립 포인트 − 남은 상품으로 재계산한 적립(상품 금액−쿠폰−사용 포인트의 1%, 배송비 제외, 1P 미만 버림). 쿠폰과 사용 포인트는 남은 주문에 그대로 둔다 (사람)"
  - "고칠 지식: docs/knowledge/points/earn-rule.md — src/orders/refund.js 환불 회수는 반올림이 아니라 위 재계산 차이 방식 (사람)"
---
## 요약
부분 환불 회수 포인트를 환불 금액의 1% 반올림에서 "저장된 적립 − 남은 상품 기준 재계산 적립(버림)"으로 바꾸는 버그 수정 의도 초안을 썼다. 사람이 규칙을 알려 줬고, O-1077/R-0311은 132P가 된다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js:35` `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`가 현재 계산(반올림, 환불 금액 기준). `src/money.js`의 `percentOf`는 Math.round라 버림이 아님.
- 같은 함수에서 `remainingGoods`(이전 환불 반영)를 이미 계산함. 재계산 기준 금액 = remainingGoods − coupon − pointsUsed.
- 검증 숫자: 47,310−13,130=34,180; −5,000−2,000=27,180 → 271P; 403−271=132.
- 테스트: `npm test`(node --test), 관련 `test/refund.test.js`. 예제: `examples/O-1077.json`, `examples/R-0311.json`.
- 참고 팀 지식: docs/knowledge/points/earn-rule.md, stored-earned-points.md
