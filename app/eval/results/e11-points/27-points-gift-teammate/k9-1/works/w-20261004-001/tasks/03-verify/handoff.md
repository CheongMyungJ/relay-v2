---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(환불 회수 기준, 저장값 분기 가독성)을 반영하지 않음"
    why: "환불 회수는 적립 예정 계산 범위 밖이라 별도 Work로 넘김, 사소 지적은 동작 문제 없음"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립 기준은 O-1042 한 건에서 역산해 고객센터 규칙과 다를 수 있다"
  - "환불 회수(src/orders/refund.js:34)가 옛 기준(반올림)이라 부분 환불 시 적립값과 어긋날 수 있다"
  - "선물하기 적립(src/gift/gift-points.js)은 옛 기준 그대로(범위 밖)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건은 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과, `npm test` 24개 통과, O-1042는 237P. 바뀐 테스트 파일은 새 `test/earn.test.js`뿐이고 약화 아님.
새 지식: docs/knowledge/points/earn-basis.md — 적립 기준과 아직 따르지 않는 곳을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`의 `earnPoints`. 테스트: `test/earn.test.js`.
- 확인: `node src/cli.js examples/O-1042.json` → 237P.
- 후속 후보: `src/orders/refund.js:34`, `src/gift/gift-points.js`.
