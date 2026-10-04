## 재현
- 재현 절차: `createInvoice(examples/INV-2031.json)`를 `computeTotals`에 넣는다. 견적은 `examples/Q-0457.json`을 `createQuote`, 반품은 `examples/CN-0112.json`을 INV-2047에 `createCreditNote`
- 결과: 재현됨
- 기대: INV-2031 부가세 2,641원, 합계 29,079원
- 실제: 부가세 2,644원, 합계 29,082원 (수정 전)

## 원인
- 원인: 세 문서가 회계팀 규칙(과세 줄마다 할인 후 금액 × 10% 버림의 합)과 다르게 계산했다. 청구서와 반품 전표는 과세 공급가액 합계에 한 번 `Math.round`, 견적서는 할인 전 금액 합의 10%(반올림)에서 할인 합의 10%(반올림)를 뺐다.
- 근거: `src/invoice/total.js` vat 줄, `src/invoice/quote.js` quoteTotals, `src/invoice/credit-note.js` creditTotals. 수정 뒤 INV-2031은 536+633+325+837+310=2,641, 합계 29,079로 나온다. 수정 전 코드는 stash로 되돌려 새 테스트 4개가 실패하는 것을 확인했다.
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 합계에 한 번 반올림해 줄별 버림과 어긋난다. 견적서는 반올림 외에 할인 전 금액 기준이라는 차이도 있었다.
- 기각한 가설: 없음

## 변경 요약
- src/money.js — `floorPercentOf`(원 단위 버림) 추가
- src/invoice/total.js — `lineVat`(줄 부가세 규칙) 추가, `computeTotals`가 줄별 합으로 부가세 계산
- src/invoice/quote.js — `quoteTotals`가 `lineVat` 사용 (할인 전 금액 기준 계산 제거)
- src/invoice/credit-note.js — `creditTotals`가 `lineVat` 사용
- 저장된 totals와 `src/format/`은 건드리지 않았다. 발행된 청구서·저장된 견적서·반품 전표는 재계산하지 않는다.
- 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: test/total.test.js(INV-2031, 할인·면세 줄별), test/quote.test.js(Q-0457, 영세율), test/credit-note.test.js(줄별 버림, 영세율)
- 수정 전: 실패 — `src/`를 되돌리고 `npm test`: 54개 중 4개 실패(`# fail 4`)
- 수정 후: 통과 — `npm test`: `# pass 54`, `# fail 0`

## 테스트 실행
- 명령: `npm test`
- 결과: 54개 모두 통과
- 실패 항목: 없음

### 반품 전표와 원 청구서 부가세 맞물림 (확인 결과)
INV-2047은 옛 규칙으로 저장된 부가세가 5,801원이다(공급가액 58,006원의 10% = 5,800.6 반올림). 새 규칙으로 줄별 계산하면 5,798원이다.
- 전부 반품: 반품 부가세 5,798원, 원 청구서 5,801원 → 3원 차이 (반품이 적음)
- CN-0112 일부 반품(공급가액 17,438원): 새 규칙 1,742원, 옛 규칙이면 1,744원 → 2원 차이
- 새 규칙으로 발행한 청구서와는 전부 반품 시 부가세가 같다. 줄 구성이 같으면 줄별 값이 같기 때문이다. 일부 반품은 `returnedDiscount`의 수량 비율 반올림 때문에 줄 값이 달라질 수 있다.
- 차이는 옛 규칙으로 저장된 청구서에 새 규칙 반품 전표를 붙일 때 생긴다. 보정 규칙은 만들지 않았다.
