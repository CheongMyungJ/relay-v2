---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "total.js에서만 줄별 Math.floor 합산으로 고치고 percentOf는 그대로 둔다"
    why: "percentOf는 견적서도 쓰며 견적서는 비목표"
    by: ai
assumptions:
  - "과세 줄의 net(할인 후 공급가액)에 10%를 적용해 버린다"
rejected:
  - "percentOf 수정: 견적서 금액이 바뀌어 비목표 위반"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(src/invoice/credit-note.js:90)는 여전히 합계 기준 Math.round라 청구서와 부가세가 어긋날 수 있음(범위 밖)"
  - "회계팀 공식 기준 미확인"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 품목 줄마다 원 미만 버림 후 합산한다 (사람)"
  - "아직 규칙을 따르지 않음: 견적서(src/invoice/quote.js)와 반품 전표(src/invoice/credit-note.js) — 합계 기준 반올림, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
`computeTotals`의 부가세를 과세 줄별 버림 합산으로 바꿨다. INV-2031은 2,641원/29,079원이다. 테스트 2개를 추가했고 npm test 50개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` vat 계산. 테스트: `test/total.test.js` 끝 2개.
- 발행 청구서는 `invoiceTotals`(src/invoice/invoice.js)가 저장 totals를 써서 영향 없음.
- 확인: `node src/cli.js examples/INV-2031.json --totals`, `npm test`.
