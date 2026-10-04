---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "리뷰 지적이 없어 사람에게 반영 여부를 묻지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "과거에 옛 식으로 처리한 환불이 alreadyRefunded에 있으면 이번 식과 합이 1P쯤 다를 수 있다"
  - "src/points/earn.js와 src/gift/gift-points.js는 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 이번 범위 밖"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 모든 완료조건 통과(npm test 22개, R-0311 -132P, 환불 금액·format 출력 동일). pr.md 작성.
고친 지식: docs/knowledge/points/earn-basis.md — 부분 환불 회수를 저장된 적립 − 남은 상품 재계산 적립(버림)으로 바꾸고 여러 번 환불 규칙과 이력을 더함(앞 Work 내용은 살림)
## 다음 task가 알아야 할 것
- `src/orders/refund.js` 34행 근처 `earnedOn`, `earnedBefore`, `pointsRecovered`.
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P.
- `npm test` 22개 통과.
