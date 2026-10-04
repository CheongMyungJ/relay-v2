---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄마다 percentOfFloor로 버림해 합산하도록 고쳤다"
    why: "팀 지식 docs/knowledge/billing/vat-rounding.md 규칙"
    by: ai
  - what: "money.js에 percentOfFloor를 추가했다"
    why: "앞 Work가 추가한 함수가 이 브랜치에 아직 없음"
    by: ai
assumptions:
  - "회계팀 기대값은 줄별 버림 규칙대로 19,180원이라고 가정함"
rejected:
  - "returnedDiscount 반올림 변경: 규칙이 정한 범위 밖이고 어긋남을 부가세만으로 설명할 수 있음"
open_questions: []
intent_deviation: null
risks:
  - "percentOfFloor는 앞 Work(w-20261004-001)에서도 추가했을 수 있음, 머지 대기. 머지 때 충돌 가능"
  - "청구서(computeTotals)와 견적서는 범위 밖이라 Math.round 그대로임. 앞 Work에서 고쳤을 수 있음, 머지 대기"
  - "비율 할인 부분 반품의 할인 반올림(322.5→323)은 규칙이 없어 그대로 둠"
recommended_next: null
knowledge_candidates:
  - "반품 전표(creditTotals)의 부가세도 줄별 원 단위 버림 합산이다. 예: CN-0112 부가세 1,742, 합계 19,180원 (사람)"
  - "정하지 않음: 부분 반품 시 할인 반올림 규칙 — 규칙 없음, 지금 코드는 percentOf/Math.round (사람이 정하지 않음)"
---
## 요약
`creditTotals`가 합계에 한 번 반올림하던 부가세를 줄별 버림 합산으로 고쳤다. CN-0112는 19,182원에서 19,180원이 됐다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`의 `vat`, `src/money.js` `percentOfFloor`
- 테스트: `npm test` 50개 통과. 추가 테스트는 `test/credit-note.test.js` 끝
- `src/format/` 변경 없음, `creditNoteTotals`는 저장된 totals를 그대로 반환
