---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1번(사소, 주석 문장)만 반영하고 2번(percentOf 미사용)은 반영하지 않는다"
    why: "사람이 1번만 반영을 선택함"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "R-0311(O-1077) 회수가 131P에서 132P로 바뀐다"
  - "회수는 alreadyRefunded 입력에 의존한다"
  - "percentOf가 src에서 쓰이지 않는다(반영 안 함)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 1번만 반영해 커밋(38e5b32)했다. 완료조건 10건 모두 통과, `npm test` 27건 통과. 바뀐 테스트 파일은 새 `test/earn.test.js`뿐이라 약화 아님. `pr.md` 작성.
새 지식: docs/knowledge/points/earn-rule.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
새 지식: docs/knowledge/points/partial-refund-recovery.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`(`earnBase`, `earnOn`, `earnPoints`)
- 회수 계산: `src/orders/refund.js:31` `keep()`
- 확인 명령: `npm test`, `node src/cli.js examples/O-1042.json`(237P), `node src/cli.js examples/R-0311.json --order examples/O-1077.json`(-132P)
