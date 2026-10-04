---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 규칙은 팀 지식(vat-per-line-floor)을 제약으로 옮기고 사람에게 다시 묻지 않는다"
    why: "사람이 정한 회계팀 규정이고 반품 전표에도 적용된다고 적혀 있다"
    by: ai
assumptions:
  - "회계팀이 기대하는 값은 팀 지식의 줄별 버림 규칙으로 계산한 값이라고 본다. CN-0112의 기대 합계는 요청에 없어 적지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목 두 개가 기준 브랜치에 아직 없다(Work w-20261004-001, 머지 대기). 앞 Work에서 total.js의 lineVat/sumLineVat을 이미 고쳤을 수 있고, 이 브랜치에는 그 코드가 없을 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 저장된 금액 재계산 금지와 `src/format/` 불변을 비목표로 두었다.
## 다음 task가 알아야 할 것
- 코드는 바꾸지 않았다. 원인은 조사하지 않았다.
- `src/invoice/credit-note.js`의 `creditTotals`가 부가세를 과세분 합계에 한 번 반올림해 구한다. 팀 규칙(줄마다 버림)과 다른 모양이다. 확인된 원인이 아니라 참고용 가설이다.
- 참고 팀 지식: `docs/knowledge/billing/example-json-needs-normalize.md` (examples/*.json은 `createInvoice`로 정규화해야 과세 구분이 채워진다. INV-2047 재현 시 주의).
- 테스트는 `npm test`(`node --test`), 반품 전표 테스트는 `test/credit-note.test.js`.
