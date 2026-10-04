---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 = 저장된 원래 적립 − 남은 상품으로 다시 계산한 적립(버림). O-1077/R-0311은 132P가 기대값"
    why: "사람이 정산팀 계산식과 기대값을 직접 알려 줌"
    by: human
assumptions:
  - "나눠 환불할 때도 이전 환불(alreadyRefunded)을 반영한 남은 상품으로 계산한다고 보고, 회수 합계가 원래 적립을 넘지 않는 조건을 넣음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 기준 브랜치에 아직 없다. 앞 Work(w-20261004-001)가 적립 쪽을 고쳤을 수 있고, 이 브랜치의 earn.js는 아직 결제 금액 기준 반올림이다(머지 대기)"
recommended_next: null
knowledge_candidates:
  - "부분 환불 포인트 회수 = 주문에 저장된 원래 적립 − 남은 상품으로 다시 계산한 적립. 적립은 (상품−쿠폰−사용포인트)의 1%, 배송비 제외, 1P 미만 버림. 쿠폰과 사용 포인트는 남은 주문에 그대로 둔다 (사람, 정산팀 기준)"
---
## 요약
부분 환불 회수 포인트를 정산팀 계산식에 맞추는 버그 수정 intent 초안을 썼다. O-1077/R-0311 기대값은 132P이다.
## 다음 task가 알아야 할 것
- 관련 코드: `src/orders/refund.js`의 `createRefund`의 `pointsRecovered`(현재 `percentOf(refundGoods, 1)`, `src/money.js` `percentOf`는 반올림)
- 검산: O-1077 남은 상품 47,310−13,130=34,180, −5,000−2,000=27,180 → 1% 버림 271, 403−271=132
- 참고 팀 지식: `docs/knowledge/points-earn-basis-floor.md` (기준 브랜치에 없음)
- 테스트: `npm test` (`test/refund.test.js`)
