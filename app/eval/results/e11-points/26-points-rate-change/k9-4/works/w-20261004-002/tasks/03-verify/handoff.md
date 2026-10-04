---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 1번(권장, 두 번째 환불 경로 테스트)만 반영하고 2번(사소)은 반영하지 않음"
    why: "사람이 차단·권장만 반영을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이전 환불이 있는 주문은 points.earned 대신 남은 금액으로 환불 전 적립을 재계산한다. 저장값이 규칙과 다른 옛 주문은 1P 차이가 날 수 있음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 때 refund.js 충돌 가능, earnBase로 바꿔 쓰면 된다"
  - "Math.max(0, …)가 음수 회수를 조용히 0으로 자름 (지적 2, 반영하지 않음)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 권장 1건(두 번째 환불 테스트)만 반영해 커밋했다(46914ab). 완료조건 6개 모두 통과, `npm test` 22 pass. O-1077/R-0311은 132P, 환불 금액 13130.
남긴 지식: 없음 (규칙은 기존 earn-rule 항목에 이미 있고, 새로 알게 된 사람의 규칙이 없음)
## 다음 task가 알아야 할 것
- 수정: `src/orders/refund.js`의 `remainingEarn`, `pointsRecoveredOf`
- 테스트: `test/refund.test.js` 마지막 2개 (O-1077/R-0311 132P, 두 번째 환불 83P)
- 앞 Work 머지 후 `earnBase` 사용으로 정리 가능
