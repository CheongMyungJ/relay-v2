---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(creditTotals)의 부가세도 줄별 버림으로 같이 고친다"
    why: "같은 식의 합계 반올림이라 같은 오차가 남. 범위 확대를 사람에게 물어 승인받음"
    by: human
  - what: "줄별 부가세 계산을 total.js의 lineVat 한 곳에 두고 청구서와 반품 전표가 함께 쓴다"
    why: "규칙이 두 곳에서 갈라지지 않게 함"
    by: ai
assumptions:
  - "예제 줄이 모두 과세(taxType 기본값)라고 본다"
rejected:
  - "합계에서 Math.round를 Math.floor로만 바꾸기: 2,643이 되어 기대값 2,641과 다름"
open_questions: []
intent_deviation: null
risks:
  - "이미 발행된 청구서와 반품 전표는 저장된 totals를 쓰므로 바뀌지 않음. 초안 상태 청구서만 새 규칙으로 계산됨"
  - "src/export/ 등 다른 곳에서 vat를 직접 다시 계산하는지는 전수 확인하지 않음 (grep으로는 computeTotals/creditTotals 경유만 확인)"
recommended_next: null
knowledge_candidates:
  - "회계 규정: 부가세는 품목 줄마다 할인된 줄 금액에 매겨 원 단위 버림, 줄별 합이 청구서 부가세, 합계 재반올림 금지 (사람)"
  - "반품 전표(creditTotals)도 청구서와 같은 줄별 버림 규칙을 쓴다. 규칙은 src/invoice/total.js lineVat에 있다 (사람)"
  - "발행된 청구서와 반품 전표는 저장된 totals를 다시 계산하지 않는다 (사람)"
---
## 요약
부가세를 합계에 한 번 반올림하던 것을 줄별 원 단위 버림의 합으로 바꿨다. INV-2031은 부가세 2,641원, 합계 29,079원이 된다. 반품 전표도 같은 규칙으로 고쳤다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat`, `computeTotals`; `src/invoice/credit-note.js` `creditTotals`
- 재현: `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079
- `npm test` 50 pass. 새 테스트 4개는 수정 전 실패 확인함
- `src/format/` 변경 없음
