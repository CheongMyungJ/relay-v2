---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(환불 회수 기준을 적립 기준액 비례로), 2(테스트 환불 번호 분리)를 모두 반영"
    why: "사람이 모두 반영을 골랐다"
    by: human
assumptions:
  - "환불 회수는 적립 기준액/상품 금액 비율을 곱해 버림한다(고객센터 안내 문서로 확인하지 못함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "237P 식과 환불 회수 규칙은 안내 문서로 확인하지 못했다"
  - "이미 적립된 주문의 points.earned는 옛 방식 값 그대로"
  - "선물하기 적립은 일반 주문과 기준이 다르다(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건을 모두 반영했고(커밋 4a4e839) 모든 완료조건이 통과했다. `npm test` 25개 통과, O-1042는 237P. 남긴 지식: docs/knowledge/points-earn-basis-floor.md
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34-37`: 회수 = floor(환불 상품 금액 × 적립 기준액 × 1% ÷ 상품 금액).
- `src/points/earn.js:6-7`: 적립 식. `src/money.js`의 `floorPercentOf`.
- 명령: `npm test`, `node src/cli.js examples/O-1042.json` → 237P.
- 산출물: verification.md, pr.md.
