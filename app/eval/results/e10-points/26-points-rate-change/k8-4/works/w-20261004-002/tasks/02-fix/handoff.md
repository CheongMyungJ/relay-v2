---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트를 환불 전후 남은 주문 적립분의 차이(상품−쿠폰−사용 포인트, 배송비 제외, 버림)로 계산한다"
    why: "팀 지식 docs/knowledge/points/partial-refund-recovery.md, earn-rule.md. 기대 132P와 일치"
    by: ai
assumptions:
  - "이 브랜치에는 earnBase/earnOn이 없어 refund.js 안에 같은 식의 작은 함수 earnOnBase를 뒀다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립식 공유 함수(earnOn)는 앞 Work(w-20261004-001)에서 이미 만들었을 수 있음, 머지 대기. 머지 시 refund.js의 earnOnBase를 그쪽으로 바꿔야 함"
  - "이 브랜치의 earnPoints는 아직 총액 기준·반올림이라 옛 규칙으로 저장된 주문은 저장 적립과 회수 합이 맞지 않을 수 있음"
  - "나눠 환불 테스트는 수정 전에도 통과함(회귀 방지용)"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 계산 위치는 src/orders/refund.js createRefund. 환불 금액에 적립률을 곱하면 쿠폰·사용 포인트가 있는 주문에서 1~2P 어긋난다"
---
## 요약
부분 환불 회수를 환불 금액×적립률 대신 환불 전후 남은 주문 적립분의 차이로 바꿨다. O-1077/R-0311은 131P에서 132P가 됐고 환불 금액은 그대로다. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/orders/refund.js` `earnOnBase`와 `createRefund`의 pointsRecovered.
- 테스트: `test/refund.test.js` 하단 2개 추가.
- 확인 명령: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P.
