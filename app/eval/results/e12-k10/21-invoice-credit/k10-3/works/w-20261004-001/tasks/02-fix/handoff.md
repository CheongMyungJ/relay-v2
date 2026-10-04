---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(creditTotals)의 부가세는 이번에 고치지 않고 청구서만 고친다"
    why: "범위 확장 여부를 사람에게 물었고 '청구서만 고침'을 선택함"
    by: human
  - what: "부가세는 줄마다 Math.floor로 계산해 sumWon으로 합산"
    why: "intent의 원하는 결과와 회계팀 기준"
    by: ai
assumptions:
  - "INV-2031의 모든 줄이 과세이고 세율 10%"
rejected:
  - "할인 적용 순서 문제: lineAmounts가 이미 줄별로 할인 후 금액을 줌"
  - "발행 청구서 재계산 문제: invoiceTotals가 저장된 합계를 쓰며 변경하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 creditTotals는 여전히 합계에 한 번 반올림해, 같은 품목을 반품하면 청구서 부가세와 1원 차이가 날 수 있음"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 반품 전표 부가세 계산 규칙 — 회계팀 확인 후 정함, 지금 코드(src/invoice/credit-note.js creditTotals)는 합계 기준 반올림 (사람)"
---
## 요약
부가세를 줄별 원 단위 버림 합산으로 바꿔 INV-2031 합계가 29,079원이 됐다. 테스트 2개를 추가했고 `npm test` 48개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` `computeTotals`의 `vat`
- 재현: `node src/cli.js examples/INV-2031.json --totals`
- 반품 전표 `creditTotals`(`src/invoice/credit-note.js`)는 범위에서 뺌. 기존 반품 테스트 기댓값은 그대로 통과
- 발행 청구서는 `invoiceTotals`가 저장값을 쓰므로 영향 없음
