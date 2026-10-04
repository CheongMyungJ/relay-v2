---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(사소)을 반영하지 않는다"
    why: "범위가 좁고 완료조건에 영향이 없어 사람이 반영하지 않음을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "배송비 제외와 버림 규칙은 O-1042 한 건에서 역산했다"
  - "환불 회수는 percentOf 반올림이라 적립과 1P 어긋날 수 있다. 선물하기 적립은 배송비 포함 반올림 그대로다"
  - "저장된 포인트를 환불이 그대로 쓴다는 점을 고정하는 테스트가 없다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이었고 반영하지 않았다. 완료조건 5개 모두 통과했다(O-1042 237P, npm test 23건, 테스트 약화 없음, format·gift 변경 없음). `pr.md`를 썼다.
새 지식: docs/knowledge/points/earn-base-and-rounding.md — 적립 기준·버림 규칙을 다루는 기존 항목이 없다
새 지식: docs/knowledge/points/stored-points-not-recalculated.md — 저장된 포인트 재계산 금지 규칙(사람)을 다루는 기존 항목이 없다
새 지식: docs/knowledge/format/receipt-text-frozen.md — 영수증 글자 수정 금지 규칙(사람)을 다루는 기존 항목이 없다
새 지식: docs/knowledge/gift/gift-points-hands-off.md — 선물하기 적립 수정 금지 규칙(사람)을 다루는 기존 항목이 없다
## 다음 task가 알아야 할 것
- 수정은 `src/points/earn.js`(커밋 3fe5284), 테스트는 `test/earn.test.js`.
- 확인: `node src/cli.js examples/O-1042.json` → 237P, `npm test` → 23건 통과.
- 지식 커밋은 `docs/knowledge/` 아래 4개 파일.
