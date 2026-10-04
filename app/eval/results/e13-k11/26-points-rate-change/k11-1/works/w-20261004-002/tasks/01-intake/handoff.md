---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 = 저장된 원 적립 포인트 − 남은 상품으로 재계산한 적립 포인트(1P 미만 버림)"
    why: "정산팀 기준을 사람이 알려 줌. O-1077: 403 − floor(27180×1%)=271 → 132P"
    by: human
  - what: "비목표는 요청 원문대로(환불 금액, 영수증 글자, 기적립·기처리 환불 재계산 제외)"
    why: "사람이 그대로 두기로 함"
    by: human
assumptions:
  - "전체 취소와 선물하기는 범위 밖으로 둠"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 earn-points-rule.md는 앞 Work(w-20261004-001)에서 왔고 머지 대기. 이 브랜치의 earnPoints는 결제 금액 기준 반올림이라 아직 규칙과 다를 수 있음(앞 Work에서 고쳤을 수 있음, 머지 대기)"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 주문에 저장된 원 적립 포인트 − 남은 상품으로 재계산한 적립 포인트. 재계산은 (남은 상품 금액 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림. 쿠폰과 사용 포인트는 남은 주문에 그대로 둠 (사람)"
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 어긋나는 버그의 intent를 정리했다. 기대 규칙은 사람이 알려 줌.
## 다음 task가 알아야 할 것
- `src/orders/refund.js`의 `pointsRecovered`가 현재 `percentOf(refundGoods, POINT_RATE_PERCENT)`로, 환불 금액만 보고 계산한다(참고, 원인 확정 아님).
- `src/money.js` `percentOf`는 반올림(`Math.round`)이다. 규칙은 버림.
- 예시: O-1077 현재 131P, 기대 132P. 남은 상품 34,180원 − 5,000 − 2,000 = 27,180 → 271P, 403 − 271.
- 참고 지식: docs/knowledge/points/earn-points-rule.md (기준 브랜치에는 아직 없음)
