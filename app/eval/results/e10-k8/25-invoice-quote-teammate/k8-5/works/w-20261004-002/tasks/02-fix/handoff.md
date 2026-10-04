---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 줄마다 원 단위 버림으로 계산해 합산한다"
    why: "팀 지식 docs/knowledge/billing/vat-per-line-floor.md의 회계팀 규정"
    by: ai
  - what: "lineVat/sumLineVat을 total.js가 아니라 credit-note.js에 둔다"
    why: "기준 브랜치 total.js에 없고, 청구서·견적서 수정은 비목표이며 앞 Work와의 충돌을 피한다"
    by: ai
assumptions:
  - "비율 할인의 반올림(percentOf, 형광펜 5% = 322.5 -> 323)은 규정에 없어 그대로 뒀다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 total.js에 lineVat/sumLineVat을 고쳤을 수 있음, 머지 대기. 머지 뒤 credit-note.js의 같은 이름 함수를 공유 코드로 바꿔야 할 수 있음"
  - "docs/knowledge가 이 브랜치에 없어 지식 항목은 context.md 내용으로 확인함"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세도 줄별 버림 규칙을 따른다. CN-0112 기대값은 부가세 1,742원, 합계 19,180원 (INV-2047 기준)"
---
## 요약
반품 전표 부가세가 과세분 합계의 반올림이어서 1,744원(합계 19,182)으로 나오던 것을 줄별 버림 합 1,742원(합계 19,180)으로 고쳤다. 재현 테스트는 수정 전 실패, 후 통과. npm test 50개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `lineVat`/`sumLineVat`/`creditTotals`
- 테스트: `test/credit-note.test.js` 끝의 2개
- `creditNoteTotals`는 저장된 totals를 그대로 반환(변경 없음). `src/format/` 변경 없음
- 재현 시 INV-2047은 createInvoice 후 issueInvoice로 발행해야 반품 가능
