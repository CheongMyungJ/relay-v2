---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트는 환불 전후 적립 포인트의 차이로 정한다"
    why: "팀 지식 partial-refund-recovery.md와 정산팀 값 132P(403−271)가 일치함"
    by: ai
assumptions:
  - "O-1077은 배송비 0이라 기준 금액 40,310원, 환불 후 27,180원으로 계산했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 이 브랜치의 src/points/earn.js는 아직 옛 기준(결제액 반올림)이고 src/money.js percentOf는 반올림이다"
  - "옛 기준으로 저장된 과거 주문을 부분 환불하면 새 기준 회수 값이 저장 적립과 어긋날 수 있음(소급 수정 안 함)"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P 어긋나는 버그의 intent 초안을 썼다. 회수는 환불 전후 적립 차이, 적립은 배송비 제외 기준 금액의 1% 버림이라는 팀 지식을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34`: 지금은 `percentOf(refundGoods, POINT_RATE_PERCENT)`(환불 상품 금액의 1% 반올림)로 131P.
- 참고: 반올림으로 차이를 내면 403−272=131, 버림이면 403−271=132. 버림이 필요하다. `src/money.js`의 `percentOf`는 반올림이라 다른 곳에 쓰이니 주의.
- 참고 팀 지식: docs/knowledge/points/earn-base.md, docs/knowledge/points/partial-refund-recovery.md (기준 브랜치에 아직 없음)
- 테스트: `npm test`, 기존 `test/refund.test.js:20`은 회수 100P를 기대함
