---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 = 환불 전 적립 기준 − 환불 후 적립 기준(각각 버림)"
    why: "팀 지식 docs/knowledge/points/earn-base.md: 환불 회수도 같은 적립 기준. 저장된 earned는 재계산하지 않음(stored-earned-not-recalculated.md)"
    by: ai
  - what: "기준 브랜치에 없는 earnFromAmounts를 earn.js에 새로 추가"
    why: "earn-base.md의 새 적립·회수 경로는 이 함수를 쓴다는 규칙"
    by: ai
assumptions:
  - "정산팀 계산이 적립 기준 차이 방식이라고 보고, R-0311의 132P 일치로 확인함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 earnFromAmounts를 이미 만들었을 수 있음, 머지 대기. 머지 때 src/points/earn.js가 충돌할 수 있음"
  - "earnPoints(저장 적립)는 아직 결제 금액 기준이라 배송비가 있는 주문은 적립과 회수 기준이 다를 수 있음. 범위 밖이라 안 건드림"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트는 환불 상품 금액의 1%가 아니라 환불 전·후 남은 기준 금액(상품−쿠폰−사용 포인트)의 적립 차이다. 위치: src/orders/refund.js"
---
## 요약
부분 환불 회수 포인트를 적립 기준 차이로 계산하게 고쳤다. O-1077/R-0311은 131P에서 132P가 되고 환불 금액은 그대로다. 테스트를 추가했고 npm test는 21개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund: `earnFromAmounts` 두 번 호출한 차이
- `src/points/earn.js`: `earnFromAmounts` 추가
- 재현: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P
- 테스트: `npm test` (21 pass)
