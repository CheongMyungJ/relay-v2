---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림, 그 합이 청구서 부가세. 합계에서 재반올림 없음. 할인은 줄마다 부가세 전에 적용"
    why: "사람이 회계팀 규정으로 알려 줌. INV-2031 회계팀 합계 29,079원과 일치 확인"
    by: human
  - what: "반품 전표(CN-0112)와 견적(Q-0457)도 같은 부가세 규칙으로 맞추는 쪽으로 범위에 넣음"
    why: "사람 요청: 같은 규칙을 쓰면 청구서와 어긋나면 안 됨. 확인 결과 둘 다 현재 규칙과 다름"
    by: human
assumptions:
  - "면세 줄과 영세율 청구서는 부가세 0을 유지"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표는 원 청구서가 옛 규칙으로 발행됐으면 부가세가 청구서 부가세와 1~2원 어긋날 수 있음 (돌려주는 금액이 줄 단위로 다시 계산되므로)"
  - "발행된 청구서는 저장된 totals를 쓰는데, 재계산 경로가 없는지 fix에서 확인 필요"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 품목 줄마다 원 단위 버림으로 계산해 그 합을 쓴다. 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 매긴다 (회계팀 규정) (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 쓴다. src/format/ 출력 형식은 바꾸지 않는다 (사람)"
---
## 요약
청구서 부가세를 줄별 버림 합으로 바꾸는 bugfix intent 초안을 썼다. INV-2031은 29,082원에서 29,079원이 되어야 한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:28`: 현재 `Math.round(taxable * 10 / 100)`로 청구서 전체 과세액에 한 번만 반올림.
- `src/invoice/invoice.js:35,42`: `computeTotals` 호출부. 저장된 `totals` 사용 여부 확인할 것.
- 반품 전표 `src/invoice/credit-note.js:90`: 청구서와 같은 방식(과세 전체에 한 번 `Math.round`). 저장된 totals는 `creditNoteTotals`가 그대로 씀.
- 견적 `src/invoice/quote.js:42-43`: 할인 전 과세액 부가세(`percentOf`) − 할인액 부가세(`percentOf`), 두 번 반올림. 규칙과 다름. `createQuote`가 만들 때 `totals` 저장.
- 둘 다 줄 단위 값은 `rows`에 이미 있어 줄별 부가세 계산으로 바꾸기 쉬움. 공통 도우미로 묶는 것을 검토.
- 현재 `npm test` 48개 통과.
- 계산 검증: 줄별 버림 536+633+325+837+310=2,641, 공급가액 26,438, 합계 29,079.
