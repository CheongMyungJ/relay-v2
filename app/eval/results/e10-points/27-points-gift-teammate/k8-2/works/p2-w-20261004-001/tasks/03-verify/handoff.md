---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2를 반영하지 않는다"
    why: "1은 환불 로직이라 intent 범위 밖이고, 2는 동작 영향이 없는 사소한 지적이다"
    by: human
assumptions:
  - "218P를 올바른 값으로 본다(intake의 가정을 따른다)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34 환불 회수 포인트가 반올림이라 적립(내림)과 1P 차이가 날 수 있다"
  - "5ff61ae 이전 적립 방식이 고객센터와 맞춘 규칙이었는지 팀 확인이 필요하다(이 Work는 earn.js를 바꾸지 않음)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(환불 회수 반올림, 래퍼)은 사람이 반영하지 않기로 했다. 6개 완료조건은 모두 통과했다. `npm test`는 23개 통과, G-0213은 218P다.
새 지식: docs/knowledge/points/earn-points-single-source.md — 맞는 기존 항목이 없는 까닭: 적립 계산 단일 규칙과 환불 불일치를 다루는 항목이 없었다
새 지식: docs/knowledge/points/no-recalculation-of-earned-points.md — 맞는 기존 항목이 없는 까닭: 사람이 알려 준 재계산 금지 규칙을 다루는 항목이 없었다
## 다음 task가 알아야 할 것
- 변경: `src/gift/gift-points.js`, `test/gift.test.js`. `earn.js`는 이 Work에서 바뀌지 않았다.
- 확인 명령: `node src/cli.js examples/G-0213.json`, `npm test`
- 후속 후보: `src/orders/refund.js:34`의 `percentOf` 반올림
