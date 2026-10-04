---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "나눠 환불할 때 이번 회수 = (원래 적립 − 남은 적립) − 이전 환불까지의 누적 회수"
    why: "완료조건: 회수 합계가 원래 적립을 넘지 않아야 함. 단순히 원래 적립 − 남은 적립을 매번 쓰면 중복 회수됨"
    by: ai
  - what: "남은 상품 적립은 refund.js 안에서 버림으로 계산하고 money.js percentOf와 earn.js는 건드리지 않음"
    why: "비목표(적립 계산 변경 금지), 팀 지식 docs/knowledge/points-earn-basis-floor.md의 버림 규칙"
    by: ai
assumptions:
  - "이전 환불이 없으면 저장된 points.earned를 그대로 쓰고, 있으면 남은 상품으로 다시 계산한 적립을 이전 누적 계산에 쓴다고 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 기준 브랜치에 아직 없고 earn.js는 결제 금액 기준 반올림 그대로임(앞 Work w-20261004-001에서 고쳤을 수 있음, 머지 대기)"
  - "저장된 earned가 현재 규칙의 재계산값과 다른 옛 주문은 첫 환불에서 그 차이만큼 회수에 반영됨"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 원래 적립 − 남은 상품 적립(버림). 나눠 환불은 이전 누적 회수를 빼 합계가 적립을 넘지 않게 한다 (사람, 정산팀 기준)"
---
## 요약
부분 환불 회수 포인트를 정산팀 기준으로 고쳤다. O-1077/R-0311은 131P에서 132P가 되었고 환불 금액은 13,130원 그대로다. 테스트 2개를 추가했고 `npm test` 22개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/orders/refund.js`의 `earnedOnRemaining`와 `createRefund`의 `pointsRecovered`
- 테스트: `test/refund.test.js` 끝의 두 테스트. 수정 전에는 `not ok 21`
- `cancelOrder`, `earn.js`, `src/format/`, `money.js`는 바꾸지 않음
