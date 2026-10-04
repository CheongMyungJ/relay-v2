---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(credit-note.js)는 이번에 고치지 않고 청구서만 고친다"
    why: "intent 범위는 새로 계산하는 청구서이고, 사람이 '청구서만 고침'을 골랐다"
    by: human
  - what: "부가세 = 과세 줄마다 Math.floor(할인 후 줄 금액 × 10 / 100)의 합"
    why: "회계 규정(intent 제약)"
    by: ai
assumptions:
  - "면세 줄과 영세율은 기존 동작 유지(면세 줄 부가세 없음, 영세율 0)"
rejected:
  - "sumWon/percentOf 문제: INV-2031에는 할인이 없고 sumWon은 정수 합만 한다"
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/credit-note.js:90 creditTotals는 여전히 합계 반올림이라, 같은 청구서의 반품 부가세가 청구서 부가세와 1~몇 원 어긋날 수 있다. 사람이 이번 범위에서 제외했다"
  - "src/format/ 출력 형식은 건드리지 않았으나 서식 테스트 외의 PDF 출력은 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세(src/invoice/credit-note.js creditTotals)는 청구서와 별도 복사본이라 청구서 부가세 규칙을 바꿀 때 같이 볼 곳이다. 이번에는 범위 밖으로 둠 (사람)"
---
## 요약
`computeTotals`의 부가세를 줄별 원 단위 버림 합으로 바꿨다. INV-2031은 29,082원에서 29,079원이 됐고 `npm test` 48개가 통과한다. 재현 테스트 2개를 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` vat 계산(줄별 `Math.floor`)
- 테스트: `test/total.test.js` 끝 2개. 수정 전 실패 2건, 수정 뒤 전부 통과
- 기존 테스트는 바꾸지 않았다. 발행 청구서의 저장 합계 유지는 `test/invoice.test.js:33`이 이미 검증한다
- 남은 범위 밖: `credit-note.js:90`
