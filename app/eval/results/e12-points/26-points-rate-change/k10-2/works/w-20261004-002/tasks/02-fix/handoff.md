---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "alreadyRefunded가 있으면 회수 전 적립을 그때 남은 상품으로 계산한 적립으로 잡는다(첫 환불은 저장된 earned)"
    why: "저장된 적립 − 남은 상품 적립을 매번 그대로 쓰면 이전 환불의 회수가 다시 들어가 합이 적립을 넘는다. 완료조건 4(회수 합 ≤ 적립)를 지키기 위함"
    by: ai
  - what: "버림 도우미 floorPercentOf를 추가하고 percentOf는 바꾸지 않는다"
    why: "percentOf는 주문 적립 등 범위 밖 코드가 쓴다"
    by: ai
assumptions:
  - "이전 환불의 회수 포인트는 호출자가 넘기지 않으므로 alreadyRefunded 수량으로 다시 구한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 earn-basis.md의 부분 환불 회수식(환불 금액의 적립률% 버림)이 사람 답과 달라 verify가 고쳐야 한다"
  - "src/points/earn.js와 src/gift/gift-points.js는 옛 기준이다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 이번 범위 밖"
  - "과거에 옛 식으로 처리한 환불이 alreadyRefunded에 있으면 이번 식과 합이 1P쯤 다를 수 있다(이미 처리한 환불은 다시 계산하지 않음)"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-basis.md — 부분 환불 회수 = 저장된 원래 적립 − 남은 상품으로 다시 계산한 적립(남은 상품 − 쿠폰 − 사용 포인트의 적립률% 버림, 배송비 제외). 쿠폰·사용 포인트는 남은 주문에 두고 안분하지 않음. 예: O-1077/R-0311 403−271=132P (사람)"
---
## 요약
부분 환불 회수 포인트를 저장된 적립 − 남은 상품 재계산 적립(버림)으로 고쳤다. R-0311은 131P에서 132P가 된다. 테스트 22개 통과.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` 34행 근처: `earnedOn`, `earnedBefore`, `pointsRecovered` 계산.
- `src/money.js`: `floorPercentOf` 추가.
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 회수 -132P, 환불 금액 13,130원 그대로.
- 테스트: `npm test`, `test/refund.test.js` 아래쪽 새 2개.
