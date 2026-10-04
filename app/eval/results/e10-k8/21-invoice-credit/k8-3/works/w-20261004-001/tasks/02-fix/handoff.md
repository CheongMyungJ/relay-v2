---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(credit-note.js)는 이번에 고치지 않고 청구서만 고친다"
    why: "사람이 질문에 '청구서만 고친다'를 선택함"
    by: human
  - what: "줄별 절사 기준은 할인 후 줄 공급가액(net)"
    why: "코드의 lineAmounts가 줄 net을 주고 부가세는 그 위에 계산됨"
    by: ai
assumptions:
  - "net이 음수인 줄은 없다고 보고 Math.floor를 썼다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표의 부가세(`src/invoice/credit-note.js` creditTotals)는 여전히 합계 반올림이라 청구서와 1~3원 어긋날 수 있다. 사람이 범위 밖으로 정함"
  - "CSV, 분개, 월별 요약은 invoiceTotals를 쓰므로 새로 계산하는 청구서부터 값이 바뀐다. 발행된 청구서는 저장된 totals를 쓴다"
recommended_next: null
knowledge_candidates:
  - "부가세는 과세 줄마다 할인 후 공급가액의 10%를 절사해 합산한다. src/invoice/total.js lineVatSum (사람)"
  - "반품 전표 부가세는 아직 합계 한 번 반올림이다. 청구서만 고치기로 함 (사람)"
---
## 요약
청구서 부가세를 과세 줄별 절사 합으로 바꿨고 INV-2031은 29,079원이 된다. 재현 테스트를 추가했고 `npm test` 50개가 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVatSum`: 줄별 `Math.floor(net*10/100)` 합
- `test/total.test.js` 끝의 테스트 4개가 새 동작을 고정한다
- `src/format/`은 바뀌지 않았다
- 반품 전표는 그대로이며 범위 밖이다
