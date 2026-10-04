---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(`credit-note.js` `creditTotals`)의 부가세 계산은 이번에 고치지 않고 청구서만 고친다"
    why: "범위가 넓어지는 선택이라 사람에게 물었고 사람이 '청구서만 고친다'를 골랐다"
    by: human
  - what: "vat를 `Math.floor(줄 net × 세율 / 100)`의 줄별 합으로 계산한다"
    why: "회계팀 규칙(줄별 원 단위 버림, 할인 후 금액 기준)과 intent"
    by: ai
assumptions:
  - "`examples/INV-2031.json`에는 taxType이 없어 `createInvoice`로 정규화해야 과세 줄이 된다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`src/invoice/credit-note.js:90`의 `creditTotals`는 여전히 합계에 반올림한다. 같은 청구서의 반품 전표 부가세가 청구서와 1~몇 원 어긋날 수 있다."
  - "이전에 /total.fixed 라는 백업 파일이 저장소 밖 루트 경로에 잘못 만들어졌을 수 있다. 삭제가 권한 검사에 막혀 지우지 못했으니 사람이 확인해 지운다."
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세(`src/invoice/credit-note.js` `creditTotals`)는 청구서와 별도 복사본이라 청구서 계산 규칙을 바꿔도 따라가지 않는다. 이번에는 사람이 청구서만 고치기로 했다 (사람)"
---
## 요약
`computeTotals`의 부가세를 합계 반올림에서 과세 줄별 버림 합산으로 바꿨다. INV-2031은 vat 2,641, 합계 29,079가 된다. 재현 테스트 2개를 추가했고 `npm test`는 48개 모두 통과했다.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/total.js:26-30`. `src/format/`은 바뀌지 않았다.
- 테스트: `test/total.test.js` 끝의 2개. 수정 전에는 실패하고 수정 후에는 통과한다.
- 반품 전표 `creditTotals`는 고치지 않았다(사람이 정함).
- 발행된 청구서는 저장된 totals를 쓰므로 영향이 없다 (`invoiceTotals`).
