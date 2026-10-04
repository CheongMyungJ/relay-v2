---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표의 부가세 계산은 이번에 고치지 않고 청구서만 고친다"
    why: "범위 확장 여부를 사람에게 물었고 '청구서만 고친다'를 골랐다"
    by: human
  - what: "줄별 부가세는 `Math.floor(net * 세율 / 100)`로 계산하고 `total.js` 안의 helper로 둔다"
    why: "`percentOf`는 반올림이라 쓸 수 없고, 다른 곳에서 쓰지 않는 규칙이라 모듈 안에 둔다"
    by: ai
assumptions:
  - "영세율·면세 줄의 부가세는 기존대로 0원"
rejected:
  - "percentOf 반올림이 원인: 부가세 경로에서 쓰지 않고 할인 없는 INV-2031에서도 재현됨"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(`src/invoice/credit-note.js:90`)는 여전히 합계에 한 번 반올림한다. 같은 청구서의 반품 부가세가 줄별 버림 부가세와 1~몇 원 어긋날 수 있다"
  - "이미 발행된 청구서는 저장된 totals를 쓰므로 바뀌지 않는다 (의도대로)"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 `src/invoice/total.js`에서 과세 줄마다 할인 후 금액에 원 단위 버림으로 계산해 합한다 (회계팀 규칙) (사람)"
  - "아직 규칙을 따르지 않음: src/invoice/credit-note.js — 반품 전표 부가세가 과세분 합에 Math.round 한 번, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
INV-2031의 합계가 29,082원으로 나오던 것은 부가세를 과세 공급가액 합에 한 번 반올림했기 때문이다. 줄별 버림 합산으로 바꿔 29,079원이 되었다. 테스트 3개를 추가했고 `npm test` 49개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 `lineVat`과 `computeTotals`의 `vat`.
- 테스트: `test/total.test.js` 끝 3개. 수정 전에는 3개 모두 실패.
- `src/format/` 변경 없음. 기존 테스트 변경 없음.
- 반품 전표 `src/invoice/credit-note.js:90`은 그대로다 (사람이 범위에서 뺌).
- 실행: `npm test`.
