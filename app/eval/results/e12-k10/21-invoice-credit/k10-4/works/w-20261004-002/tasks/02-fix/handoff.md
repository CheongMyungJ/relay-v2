---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "`lineVat`/`sumLineVat`을 `src/invoice/total.js`에 추가하고 반품 전표가 이를 쓴다. `computeTotals`는 그대로 둔다"
    why: "팀 지식 docs/knowledge/billing/vat-per-line-floor.md: 계산은 한 곳에 둔다. 비목표: 청구서 계산 동작 변경 금지"
    by: ai
assumptions:
  - "회계팀 기대값은 규칙대로 계산한 19,180원이라고 가정"
rejected:
  - "금액 할인 안분 반올림: 이 사례에서는 안분이 없고 부가세 규칙 대상이 아님"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 같은 `lineVat`/`sumLineVat`을 추가했다면 total.js 머지 충돌 가능"
  - "청구서 `computeTotals`는 아직 합계 반올림을 쓴다(비목표라 안 건드림)"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세도 청구서와 같이 과세 줄별 버림 합. CN-0112(INV-2047 반품) 부가세 1,742원, 환불 합계 19,180원 (합계 반올림 시 19,182원)"
---
## 요약
반품 전표 부가세를 합계 반올림에서 과세 줄별 버림 합으로 고쳤다. CN-0112 환불 합계는 19,182원에서 19,180원이 됐다. 재현 테스트를 추가했고 `npm test`가 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` 끝에 `lineVat(net)`, `sumLineVat(rows, zeroRated)` 추가.
- `src/invoice/credit-note.js` `creditTotals`가 `sumLineVat(rows, note.zeroRated)`를 씀.
- 테스트: `npm test`(48건 통과), 새 테스트는 `test/credit-note.test.js` 끝.
- `src/format/`과 저장된 `totals` 경로는 변경 없음.
