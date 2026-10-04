---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회계팀 방식은 품목 줄마다 부가세를 절사해 합산 (INV-2031은 29,079원)"
    why: "사람이 직접 고른 답"
    by: human
  - what: "비목표: 발행된 청구서 재계산 안 함, src/format/ 변경 안 함"
    why: "요청에 명시되었고 사람이 확인"
    by: human
assumptions:
  - "절사 기준은 할인 적용 후 줄 공급가액이다"
  - "면세 줄과 영세율은 기존 동작을 유지한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(src/invoice/credit-note.js)의 부가세 계산이 청구서와 방식이 달라질 수 있다. 사람이 이번 범위 밖으로 고르지 않았으므로 fix가 확인이 필요하다"
  - "청구서 기반 CSV, 분개, 월별 요약이 계산값을 직접 쓰는지 확인하지 않았다"
recommended_next: null
knowledge_candidates:
  - "회계팀은 부가세를 품목 줄마다 원 미만 절사해 합산한다 (사람)"
  - "발행된 청구서는 재계산하지 않고 저장된 totals를 쓴다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 몇 원 큰 문제의 의도를 정리했다. 회계팀 방식인 줄별 부가세 절사에 맞추는 것이 목표다. 발행된 청구서와 src/format/은 건드리지 않는다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:25`: 부가세를 `Math.round(taxable * 10 / 100)`로 합계에 한 번만 계산한다
- `src/invoice/invoice.js:35`: 발행 시 `computeTotals` 결과를 `totals`에 저장한다
- INV-2031: 공급가액 26,438원, 현재 부가세 2,644원, 기대 부가세 2,641원 (줄별 절사)
- 줄별 부가세: 536, 633, 325, 837, 310
- `src/invoice/credit-note.js`의 부가세 계산도 확인할 것
