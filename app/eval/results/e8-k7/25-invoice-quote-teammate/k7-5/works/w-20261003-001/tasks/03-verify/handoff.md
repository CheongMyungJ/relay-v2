---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적(quote.js)과 반품 전표(credit-note.js)도 줄별 버림으로 고친다"
    why: "사람이 회계 규칙은 회사 전체 규칙이라며 직접 지시함. intent 비목표를 사람이 바꾼 것"
    by: human
  - what: "리뷰 지적 1(사소, 음수 net의 floor)을 반영하지 않는다"
    why: "음수 줄 규칙이 불명확해 추측으로 고치지 않음. 남은 위험에 기록"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation:
  summary: "intent 비목표(견적·반품 전표는 고치지 않음)와 달리 사람의 추가 지시로 두 파일을 수정했다"
  evidence: "src/invoice/quote.js, src/invoice/credit-note.js 변경, 사람 요청 (verify 단계)"
risks:
  - "net이 음수인 줄의 floor 방향은 정해지지 않았다"
  - "견적 금액이 바뀐다(Q-0457 3,589→3,587). 이미 보낸 견적서와 다를 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)은 반영하지 않았다. 완료조건 7개 모두 통과했고 `npm test` 54개가 통과한다. INV-2031은 total 29079, Q-0457은 56278, CN-0112는 19180이다. 견적·반품 전표는 사람의 추가 요청으로 같이 고쳤다.
남긴 지식: docs/knowledge/invoice-vat-per-line-floor.md, docs/knowledge/issued-invoice-and-format-untouched.md
## 다음 task가 알아야 할 것
- 수정은 `src/invoice/total.js`의 `lineVat`(export, 세 문서가 공유)과 `computeTotals`, quote.js `quoteTotals`, credit-note.js `creditTotals`이다.
- 재현 명령: `node src/cli.js examples/INV-2031.json --totals`
- PR 초안: tasks/03-verify/pr.md
