---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 계산을 `lineVat`(tax-type.js) 한 곳으로 모아 청구서, 반품 전표, 견적서가 같이 쓴다"
    why: "규칙이 같으므로 세 곳이 다시 어긋나지 않게 하려는 것"
    by: ai
assumptions:
  - "반품 전표의 돌려받는 줄 할인(returnedDiscount)은 기존 반올림 그대로 둔다. 부가세 외 계산은 바꾸지 않는다는 비목표에 따른 것"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "새 테스트 중 면세/영세율과 저장 합계 유지 테스트는 수정 전에도 통과한다(회귀 방지용)"
  - "CN-0112 재현은 INV-2047 예제를 issued 상태로 만들어 계산했다. 실제 앱 흐름과는 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 할인 후 금액(공급가액)에 원 단위 버림으로 계산해 합산한다. 합계에서 다시 반올림하지 않는다. 청구서, 반품 전표, 견적서 모두 같다 (사람)"
---
## 요약
청구서, 반품 전표, 견적서의 부가세를 줄별 할인 후 금액의 원 단위 버림 합으로 바꿨다. INV-2031은 29,079원, CN-0112는 19,180원, Q-0457은 56,278원이 된다. `npm test` 54개 통과.
## 다음 task가 알아야 할 것
- 새 함수 `lineVat`: `src/invoice/tax-type.js`. 사용처는 `total.js`, `credit-note.js`, `quote.js`.
- 테스트: `test/vat-per-line.test.js`, 명령 `npm test`.
- 발행 청구서의 저장 합계 경로(`invoice.js` invoiceTotals)와 `src/format/`은 변경 없음.
- 사람 추정(반올림 문제)은 맞음으로 판정.
