---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 = 저장된 points.earned − floor((남은 상품 − 쿠폰 − 사용 포인트) × 1%)로 구현하고 percentOf는 쓰지 않는다"
    why: "intent의 정산팀 규칙과 팀 지식 docs/knowledge/points-earn-rule.md, points-earned-no-recalc.md"
    by: ai
assumptions:
  - "남은 상품 금액은 기존 remainingGoods(이전 부분 환불 반영)를 그대로 쓴다"
rejected:
  - "환불 상품 금액의 1% 올림: 사람이 올림이 아니라고 답함"
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded에 이전 회수 포인트가 없어, 두 번째 이후 부분 환불은 원래 적립 − 남은 재계산 적립이라 누적 회수값이 된다. 이전 환불에서 이미 회수했다면 중복 회수 가능"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/points/earn.js는 지금 반올림과 결제 금액 기준"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 주문에 저장된 원래 적립 − 남은 상품으로 다시 계산한 적립(1% 버림, 쿠폰·사용 포인트는 남은 주문에 그대로) (사람)"
---
## 요약
부분 환불 회수 포인트를 정산팀 규칙으로 고쳤다. O-1077/R-0311은 131P에서 132P가 되었고 환불 금액 13,130원은 그대로다. 재현 테스트를 추가했고 `npm test` 21개가 통과한다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`: `remainingEarn`을 구해 `order.points.earned - remainingEarn`을 회수로 쓴다.
- 테스트: `test/refund.test.js` 마지막 케이스(O-1077/R-0311). 실행은 `npm test`.
- `src/format/`, `percentOf`, `cancelOrder`는 변경 없음.
- 다회차 부분 환불의 누적 회수 문제는 미해결(risks).
