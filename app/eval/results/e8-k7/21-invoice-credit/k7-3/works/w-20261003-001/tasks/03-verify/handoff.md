---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "리뷰 지적이 없어 반영할 항목 선택 질문을 하지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 `creditTotals`(`src/invoice/credit-note.js`)는 여전히 합계에 반올림해 청구서와 몇 원 어긋날 수 있다. 사람이 청구서만 고치기로 했다."
  - "저장소 밖 `/total.fixed` 파일이 남아 있다. 사람이 확인해 지운다."
  - "줄 금액이 음수가 되는 경우는 확인하지 않았다."
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었다. 7개 완료조건을 모두 직접 다시 실행해 통과로 판정했다(INV-2031 vat 2641, total 29079, `npm test` 48개 통과, `src/format/` 변경 없음). 바뀐 테스트 파일은 `test/total.test.js` 하나이고 추가만 있어 약화 아님이다.
남긴 지식: docs/knowledge/vat-floor-per-line.md, docs/knowledge/discount-before-vat-per-line.md, docs/knowledge/inv-2031-accounting-total.md, docs/knowledge/credit-note-vat-separate-copy.md
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/total.js:26-29`. 테스트는 `test/total.test.js` 끝 2개.
- 재현: `createInvoice(INV-2031.json)` → `computeTotals`.
- `verification.md`, `pr.md`는 이 task 디렉터리에 있다.
