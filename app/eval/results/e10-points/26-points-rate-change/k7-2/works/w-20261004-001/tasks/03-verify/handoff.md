---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소: 테스트 4번이 수정 전에도 통과)은 반영하지 않는다"
    why: "나머지 테스트가 수정을 이미 검증함"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js)은 결제 금액 기준·반올림 그대로이며 규정 미확인"
  - "환불 회수(src/orders/refund.js:34)는 percentOf로 계산해 새 적립 규정과 어긋남(범위 밖, 별도 Work 예정). R-0311을 O-1077(적립 403P, 쿠폰 5,000원, 사용 포인트 2,000원)에 적용하면 회수 131P인데 규정상 132P라 272P가 남아 1P 많다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)은 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과: CLI 237P, `npm test` 24개 통과, 테스트가 수정 전 코드에서 실패함을 확인, src/format 변경 없음. 남긴 지식: docs/knowledge/points-earn-rule.md, docs/knowledge/points-earned-no-recalc.md, docs/knowledge/receipt-format-frozen.md
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/earn.test.js` (4개)
- 확인: `node src/cli.js examples/O-1042.json` → 237P, `npm test`
- 선물하기·환불 회수는 새 규정과 별개로 남아 있음
