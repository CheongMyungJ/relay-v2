---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 creditTotals도 줄별 원 단위 버림으로 고친다"
    why: "사람이 반품 전표도 같은 회계 규정이라고 알려 주고 수정을 요청함. 발행분 재계산과 src/format/은 건드리지 않음"
    by: human
assumptions:
  - "부가세 버림은 Math.floor이며 줄 금액은 0 이상이라고 가정한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "INV-2047 저장 totals(vat 5801)는 옛 값이라 새 규칙(5798)과 다르다. 발행분이라 재계산하지 않았고 CN-0112와 몇 원 어긋날 수 있다"
  - "재현 스크립트는 레포 밖(/tmp/r.mjs)에 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 재현 절차(vat 2641, total 29079)와 `npm test`(49개 통과)를 다시 실행했고, 반품 전표 부가세도 줄별 버림으로 고침(CN-0112: vat 1742, total 19180). 완료조건 7개 모두 통과. 바뀐 테스트 파일 test/total.test.js는 추가만 있어 약화 아님.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음. 청구서 부가세 줄별 버림 규정. 반품 전표 적용은 규칙으로 적지 않고 이력에만 남김(사람의 말이 "맞는 것 같다"는 추정이었음)
새 지식: docs/knowledge/invoice/issued-invoice-no-recalc.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음. 발행분 재계산 금지 규칙
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` `lineVat`/`computeTotals`, 테스트 `test/total.test.js` 끝 2개
- 반품: `src/invoice/credit-note.js` `creditTotals`가 `lineVat`(total.js, export)을 씀. 테스트 test/credit-note.test.js 끝
- 지식 커밋과 함께 pr.md 작성 완료
