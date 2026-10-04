---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트를 환불 전후 남은 주문 적립(순 금액, 버림)의 차이로 계산하고, 계산은 refund.js 안의 도우미로 둔다"
    why: "팀 지식 docs/knowledge/points/earn-basis.md 규칙. earnPoints는 비목표라 건드리지 않음"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "나눠 환불 합계 테스트는 수정 전에도 통과해, 이 입력으로는 수정 전후를 가르지 못한다"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: earnPoints는 아직 결제 금액 기준 반올림이며, refund.js의 적립 계산과 별도 구현이라 머지 뒤 합칠지 판단 필요"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트를 전후 적립(버림) 차이로 계산하게 고쳤다. O-1077/R-0311은 131P에서 132P가 되었다. 테스트 2개를 추가했고 `npm test` 22개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/orders/refund.js`의 `earnOnRemaining`과 `createRefund`의 `pointsRecovered`
- 테스트: `test/refund.test.js` 끝의 2개 추가
- `refundAmount`, `src/format/`, `earnPoints`는 바꾸지 않았다
