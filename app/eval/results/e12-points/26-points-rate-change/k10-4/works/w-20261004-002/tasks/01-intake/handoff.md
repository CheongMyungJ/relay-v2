---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수 포인트 = 저장된 원래 적립 − (남은 상품 금액 − 쿠폰 − 사용 포인트)의 1% 버림. 쿠폰·사용 포인트는 남은 주문에 그대로 둔다"
    why: "사람의 답. 정산팀의 132P와 일치(403 − 271)"
    by: human
  - what: "범위는 부분 환불 회수(createRefund)만"
    why: "사람이 추천안 선택"
    by: human
assumptions:
  - "이전 부분 환불(alreadyRefunded)이 있어도 남은 상품 금액 기준으로 재계산하며, 이전 회수분 차감은 사람이 말하지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이전 부분 환불이 있을 때 이미 회수한 포인트를 어떻게 빼는지 요청에 없다. 환불 입력에 이전 회수 포인트 정보가 없다"
  - "남은 금액이 쿠폰+사용 포인트보다 적으면 이미 전체 취소 오류로 처리된다"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 주문에 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트(적립 규정 그대로: 쿠폰·사용 포인트를 뺀 금액의 1%, 배송비 제외, 버림). 쿠폰·사용 포인트는 남은 주문에 그대로 둔다 (사람)"
  - "고칠 지식: docs/knowledge/points/earn-rule.md — 부분 환불 안분 방식은 위 규정으로 정해짐, `## 아직 정하지 않은 것`에서 규칙으로 옮김 (사람)"
---
## 요약
부분 환불 회수 포인트를 정산팀 규정(원래 적립 − 남은 상품 재계산 적립, 버림)으로 계산하도록 의도를 정리했다. 범위는 부분 환불 회수만이다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`: `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)` (`src/money.js`의 `percentOf`는 반올림)
- O-1077: 상품 47,310, 쿠폰 5,000, 사용 2,000, 적립 403. R-0311 환불 상품 13,130 → 남은 34,180 → 재계산 적립 271 → 회수 132 (현재 131)
- 테스트: `npm test`, 기존 `test/refund.test.js`
- 참고 지식: docs/knowledge/points/earn-rule.md (기준 브랜치에는 아직 없음)
