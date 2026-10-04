---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "INV-2031의 회계팀 합계는 29,079원이고, 부가세는 품목별로 버림 후 합산한다"
    why: "사람이 질문에 답함"
    by: human
  - what: "비목표는 요청에 적힌 두 가지(발행된 청구서 재계산 금지, src/format/ 변경 금지)만 둔다"
    why: "사람이 기본 비목표만 선택"
    by: human
assumptions:
  - "품목별 부가세 버림은 할인 적용 후 공급가액(net)에 10%를 곱해 버림하는 것으로 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "신용전표(credit-note)나 export가 computeTotals 결과에 기대고 있으면 영향받을 수 있음"
  - "발행된 청구서가 저장 합계를 쓰는지 아직 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목별로 원 단위 버림 후 합산한다. 회계팀 대조 기준 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 문제의 의도를 정리했다. 기대 합계는 INV-2031 기준 29,079원이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 현재 `vat = Math.round(taxable * 10 / 100)`로 합계 기준 반올림. INV-2031은 2,643.8 → 2,644원, 합계 29,082원.
- 품목별 net: 5368, 6335, 3255, 8375, 3105. 품목별 버림 부가세 합은 2,641원이라 합계 29,079원.
- 테스트: `npm test` (`node --test`), `test/total.test.js`.
- 확인할 것: `docs/knowledge/` 없음. 원인 분석은 하지 않았다. 호출처(credit-note, export, 발행 청구서의 저장 합계 사용)는 fix에서 확인한다.
