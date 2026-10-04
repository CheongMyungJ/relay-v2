---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "이 브랜치에 `lineVat`가 없어 `creditTotals` 안에서 줄별 `Math.floor(net*10/100)`를 직접 계산했다"
    why: "팀 지식 docs/knowledge/billing/vat-per-line-floor.md의 규칙을 따름. `lineVat`는 앞 Work(w-20261004-001) 머지 대기라 total.js를 건드리면 충돌할 수 있음"
    by: ai
assumptions:
  - "회계팀의 CN-0112 기대값은 규칙대로 계산한 1,742원/19,180원으로 가정 (회계팀 값은 받지 못함)"
rejected:
  - "returnedDiscount 반올림 변경: 규칙 밖이고 이번 범위 밖"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 `lineVat`를 추가했을 수 있음, 머지 대기. 머지 뒤 creditTotals가 lineVat를 쓰도록 바꿀 수 있음"
  - "줄 할인 반올림(returnedDiscount)은 그대로라 줄 공급가액이 회계팀 계산과 다를 가능성은 남음"
recommended_next: null
knowledge_candidates:
  - "반품 전표(`creditTotals`, src/invoice/credit-note.js)는 합계 부가세를 한 번 반올림해 줄별 버림 규칙과 몇 원 어긋났다. CN-0112 기준 줄별 버림 합계는 부가세 1,742원, 합계 19,180원"
---
## 요약
`creditTotals`의 부가세를 줄별 원 단위 버림 합산으로 고쳤다. CN-0112는 19,182원에서 19,180원이 된다. 재현 테스트를 추가했고 `npm test` 50개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`
- 테스트: `test/credit-note.test.js` 마지막 두 테스트 (CN-0112, 저장된 totals 유지)
- `src/format/`과 `computeTotals`는 건드리지 않음
- 저장된 `totals`는 `creditNoteTotals`가 그대로 반환
