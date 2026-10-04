---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 = 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트 (1% 버림, 쿠폰과 사용 포인트는 남은 주문에 그대로)"
    why: "사람이 정산팀 규칙으로 알려 줌. O-1077/R-0311에서 403 − 271 = 132P로 정산팀 값과 일치"
    by: human
assumptions:
  - "이전 부분 환불(alreadyRefunded)이 있는 경우의 누적 회수 방식은 요청에 없어 정하지 않았다. fix가 코드를 보고 판단해야 한다"
rejected:
  - "환불 상품 금액의 1% 올림: 사람이 올림이 아니라고 답함"
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded 입력에는 sku/qty만 있고 이전에 회수한 포인트가 없어서, 두 번째 이후 부분 환불에서 회수가 중복되거나 모자랄 수 있다"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/points/earn.js는 지금 percentOf(반올림)와 결제 금액 기준이라 팀 지식의 적립 규칙과 다르다. 이번 요청 밖이라 범위를 넓히지 않았다"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 주문에 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트. 적립은 (상품금액 − 쿠폰 − 사용포인트)의 1%, 배송비 제외, 1P 미만 버림이고 쿠폰과 사용 포인트는 남은 주문에 그대로 둔다 (사람)"
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P 다른 문제의 의도 초안을 썼다. O-1077/R-0311은 현재 131P, 정산팀 규칙으로는 132P다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`: `pointsRecovered`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`, 즉 환불 상품 금액의 1% 반올림이다(131.3 → 131).
- 정산팀 규칙으로 계산하면: 남은 상품 47,310 − 13,130 = 34,180, 거기서 쿠폰 5,000과 사용 포인트 2,000을 빼면 27,180원, 1% 버림은 271P다. 저장된 적립 403P에서 빼면 132P.
- `createRefund`는 `order.amounts.goods`, `coupon`, `pointsUsed`, `points.earned`, `alreadyRefunded`를 이미 쓴다. 남은 상품 금액은 `remainingGoods`로 이미 계산한다.
- 공용 `src/money.js` `percentOf`는 바꾸지 않는다. 테스트는 `test/refund.test.js`, 실행은 `npm test`.
- 참고할 팀 지식: docs/knowledge/points-earn-rule.md, points-earned-no-recalc.md, receipt-format-frozen.md (기준 브랜치에는 아직 없음).
