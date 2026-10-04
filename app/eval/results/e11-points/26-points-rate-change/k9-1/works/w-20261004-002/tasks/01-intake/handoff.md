---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 = 저장된 원래 적립 − 남은 상품으로 재계산한 적립(버림, 쿠폰·사용 포인트 유지, 배송비 제외)"
    why: "사람이 정산팀 규칙으로 알려 줌. O-1077은 403 − 271 = 132로 일치"
    by: human
assumptions:
  - "이미 처리한 이전 환불(alreadyRefunded)의 회수분은 다시 계산하지 않고, 이번 환불 몫은 남은 상품 금액 기준 재계산으로 구한다"
rejected:
  - "올림: 13,130원의 1%를 올림하면 132지만 정산팀 규칙이 아니라고 사람이 답함"
open_questions: []
intent_deviation: null
risks:
  - "여러 번 부분 환불할 때 이전 환불 회수분과의 합산 방식이 요청에 명시되지 않음. 저장된 earned가 옛 규칙(반올림, 배송비 포함)으로 계산됐을 수 있음"
  - "팀 지식 항목은 머지 대기 중인 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에 아직 없음. src/points/earn.js는 아직 옛 규칙(결제 금액 반올림)일 수 있음"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 주문에 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트. 재계산은 (남은 상품 금액 − 쿠폰 − 사용 포인트)의 적립률%를 1P 미만 버림, 배송비 제외, 쿠폰·사용 포인트는 남은 주문에 그대로 둠 (사람)"
  - "고칠 지식: docs/knowledge/points/partial-refund-recovery-not-proportional.md — 회수 규칙이 위처럼 정해졌다. 환불 상품 금액의 적립률% 방식이 아니다 (사람)"
---
## 요약
부분 환불 회수 포인트를 정산팀 규칙(원 적립 − 남은 상품 재계산 적립)으로 바꾸는 의도를 정리했다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`: 현재 `percentOf(refundGoods, POINT_RATE_PERCENT)`. `percentOf`(`src/money.js`)는 반올림.
- 남은 상품 금액은 이미 `remainingGoods`로 계산됨. 쿠폰·사용 포인트는 `order.amounts`.
- 기대값: O-1077/R-0311 = 132P (403 − floor(271.8)). 현재 131P.
- 참고 지식: docs/knowledge/points/earn-points-basis.md, partial-refund-recovery-not-proportional.md (기준 브랜치에 아직 없음)
- 테스트: `npm test`, `test/refund.test.js`
