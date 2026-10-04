---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수는 원래 적립 − 남은 상품으로 다시 계산한 적립으로 한다"
    why: "사람이 정산팀 계산식으로 직접 알려 줌. O-1077 검산 시 403 − 271 = 132P로 맞음"
    by: human
assumptions:
  - "이미 부분 환불한 이력(alreadyRefunded)이 있을 때 '원래 적립'과 '남은 상품'을 어떻게 잡을지는 사람이 말하지 않음. 이번 환불 직전 남은 상품 기준 적립과 환불 후 남은 상품 기준 적립의 차이로 볼지 fix에서 확인 필요"
rejected:
  - "환불 상품 금액의 1% 버림: 사람이 정산팀 계산식이 아니라고 함 (이 경우 131P라 132P와 다름)"
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 earn-rule.md의 부분 환불 회수 문장(환불 상품 금액의 1% 버림)이 사람의 지금 설명과 다름"
  - "earn-rule.md는 w-20261004-001에서 왔고 기준 브랜치에는 아직 없음. 적립 계산(src/points/earn.js)은 이 브랜치에서 아직 총 결제 금액 1% 반올림이라 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-rule.md — 부분 환불 회수 포인트는 환불 상품 금액의 1%가 아니라 '주문에 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트'이다. 다시 계산은 (남은 상품 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림이고 쿠폰·사용 포인트는 남은 주문에 그대로 둔다 (사람)"
---
## 요약
부분 환불 회수 포인트를 정산팀 계산식(원래 적립 − 남은 상품 기준 재계산 적립)에 맞추는 버그 수정 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`: `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)` (현재 131P). 남은 상품은 `remainingGoods`로 이미 계산함.
- `src/money.js` `percentOf`는 반올림이라 적립 재계산에는 버림이 필요함.
- 검산: 남은 34,180 − 5,000 − 2,000 = 27,180 → 271P, 403 − 271 = 132P.
- 참고 지식: docs/knowledge/points/earn-rule.md (기준 브랜치에 없음, 부분 환불 문장은 바뀌어야 함)
- `npm test` 20개 통과 상태.
