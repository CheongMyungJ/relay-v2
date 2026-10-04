---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수를 환불 전후 적립 기준 금액의 적립 차이로 계산하고 저장된 적립으로 상한을 둔다"
    why: "docs/knowledge/refund-recovery-follows-earn-rule.md"
    by: ai
  - what: "earn.js에 earnOn(base)(버림)를 추가하고 earnPoints는 그대로 둔다"
    why: "docs/knowledge/points-earn-excludes-shipping-floor.md. 이 브랜치에 earnOn이 없고 주문 적립 변경은 이번 범위 밖이다"
    by: ai
assumptions:
  - "정산팀 기준은 팀 지식의 규칙과 같다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 earnOn/earnPoints를 고쳤을 수 있음, 머지 대기. 머지 때 earn.js 충돌 가능, earnOn 중복 정리 필요"
  - "earnPoints(주문 적립)는 아직 결제 금액을 반올림한다. 이번에 고치지 않았다"
  - "이전 부분 환불의 실제 회수 이력은 입력에 없어 alreadyRefunded 수량으로 환불 전 기준을 계산한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수를 환불 상품 금액 × 적립률 반올림에서 환불 전후 적립 기준 금액의 적립 차이로 바꿨다. R-0311은 132P이고 적립을 넘지 않는다. 테스트 3개를 추가했고 `npm test`는 23개 통과다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund의 `pointsRecovered` 계산, `src/points/earn.js`의 `earnOn`.
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P.
- 테스트: `npm test`(23 pass), test/refund.test.js 아래쪽 3개가 새 테스트.
