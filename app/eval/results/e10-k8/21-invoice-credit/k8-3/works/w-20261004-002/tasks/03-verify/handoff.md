---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 3건(모두 사소)을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다"
    by: human
  - what: "저장된 totals 고정 규칙에 반품 전표를 더해 같은 경로에서 고친다"
    why: "사람이 t-01에서 저장된 반품 전표 totals는 재계산하지 않는다고 알려 줌"
    by: ai
assumptions:
  - "net이 음수인 줄은 없다고 보았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서 computeTotals(src/invoice/total.js)는 이 브랜치에서 아직 Math.round. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "docs/knowledge/invoice/ 두 파일은 앞 Work도 만들어 머지 시 충돌할 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건은 모두 사소해 반영하지 않았다. 완료조건 6개 모두 통과(재현 19,180원, `npm test` 49개 통과). 바뀐 테스트 파일은 약화 아님.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 반품 전표도 줄별 절사로 바뀌어 '아직 규칙을 따르지 않는 곳'을 빼고 CN-0112 예와 이력을 더함
고친 지식: docs/knowledge/invoice/issued-invoice-totals-frozen.md — 저장된 반품 전표 totals도 재계산하지 않는다는 규칙을 더함
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js:91` `creditTotals` vat 줄. 테스트는 `test/credit-note.test.js` 끝의 3개.
- 재현: `createCreditNote(examples/INV-2047.json, examples/CN-0112.json).totals` → vat 1742, total 19180.
- 지식 파일 두 개는 기준 브랜치에 없어 이 Work에서 같은 경로로 썼다.
