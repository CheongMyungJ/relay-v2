---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 줄마다 버림(`lineVat`)으로 계산하고, `lineVat`를 `src/invoice/total.js`에 추가"
    why: "docs/knowledge/invoice/vat-per-line-floor.md 규칙. 기준 브랜치에 lineVat이 없어 새로 추가"
    by: ai
  - what: "청구서 `computeTotals`는 고치지 않음"
    why: "intent 비목표"
    by: ai
assumptions:
  - "회계팀의 CN-0112 기대 금액은 규정대로 계산한 19,180원이라고 가정함"
rejected:
  - "할인 계산(`returnedDiscount`) 오차: 규정이 할인 반올림을 바꾸지 않았고 부가세만 바꿔 규정 값이 나옴"
open_questions: []
intent_deviation: null
risks:
  - "`lineVat`는 앞 Work(w-20261004-001)에서 이미 추가했을 수 있음, 머지 대기. 머지 때 `src/invoice/total.js`가 충돌할 수 있음"
  - "`computeTotals`는 여전히 합계 반올림 방식이라 청구서와 반품 전표 규정이 어긋나 있을 수 있음(앞 Work에서 고쳤을 수 있음, 머지 대기)"
recommended_next: null
knowledge_candidates: []
---
## 요약
`creditTotals`가 부가세를 합계에서 한 번 반올림해 CN-0112가 19,182원이 나왔다. 줄마다 버림으로 바꿔 19,180원이 된다. 테스트 2개를 추가했고 `npm test`는 48개 통과.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 줄마다 `lineVat` 합산
- `src/invoice/total.js` `lineVat(net)`: 새로 추가
- CN-0112: 공급가액 17,438, 부가세 1,742, 합계 19,180
- 테스트 `npm test`, 추가 테스트는 `test/credit-note.test.js` 끝
