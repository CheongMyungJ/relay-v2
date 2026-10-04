---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 계산(earnPoints)은 건드리지 않고 refund.js에 남은 주문 적립 계산(`remainingEarn`)을 둔다"
    why: "earn-rule.md의 `earn.js` 통합은 앞 Work(w-20261004-001) 몫이고 이 브랜치엔 없다. 범위를 넓히면 머지 충돌과 신규 주문 적립 변경이 생긴다 (docs/knowledge/points/earn-rule.md, partial-refund-recovery.md)"
    by: ai
assumptions:
  - "정산팀 계산은 남은 주문 적립(1% 버림, 배송비 제외)의 차이와 같다고 가정함. O-1077/R-0311에서 132P로 확인함"
rejected:
  - "남은 주문 적립을 기존 반올림 방식으로 계산: 272가 되어 131P라 정산값 132P와 안 맞음"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: `earnBase`/`earnOn`이 머지되면 `remainingEarn`을 그쪽 함수로 바꿔 한 곳으로 합쳐야 하고, 머지 때 refund.js 충돌 가능성이 있다"
  - "다회 환불 합계 테스트는 수정 전에도 통과해 회귀 가드 역할만 한다"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 환불 전 남은 주문 적립액 − 환불 후 남은 주문 적립액(1% 버림, 저장된 적립액 이하). O-1077/R-0311 = 132P"
---
## 요약
부분 환불 회수 포인트를 환불 상품 금액의 1% 반올림에서 남은 주문 적립액의 차이로 바꿨다. R-0311은 132P를 회수한다. 재현 테스트와 다회 환불 합계 테스트를 추가했고 `npm test`는 22개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정 위치: `src/orders/refund.js`의 `remainingEarn`과 `createRefund`의 `pointsRecovered`
- 테스트: `test/refund.test.js` 끝의 테스트 2개. 실행은 `npm test`
- `refundAmount`, `cancelOrder`, `src/format/`은 변경 없음
- `earn.js`는 옛 방식 그대로다. 앞 Work 머지 뒤 통합이 필요하다
