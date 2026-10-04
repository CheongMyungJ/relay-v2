---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트는 환불 전후 남은 주문의 적립(순 금액, 버림) 차이로 계산한다"
    why: "팀 지식 earn-basis.md 규칙이 부분 환불 회수를 그렇게 정한다. 사람에게 다시 묻지 않음"
    by: ai
assumptions:
  - "정산팀 132P는 팀 지식 규칙으로 계산한 값과 일치한다고 보았다(40310→403, 남은 27180→271, 차이 132)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 이 브랜치의 `earnPoints`는 아직 결제 금액 기준 반올림이다"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P 어긋나는 버그의 intent 초안을 썼다. 팀 지식의 적립 규칙(버림, 전후 차이)을 제약에 옮겼다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` `createRefund`: `pointsRecovered`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`이다. `percentOf`(`src/money.js`)는 반올림이다. 이건 확인하지 않은 참고용 관찰이다.
- O-1077/R-0311: 환불 상품 13,130원 → 현재 131P. 전후 차이 방식이면 403 − 271 = 132P.
- 참고 지식: docs/knowledge/points/earn-basis.md (기준 브랜치에 아직 없음)
- 테스트: `npm test` (`node --test`), `test/refund.test.js`
