---
schema_version: 1
version: 1
type: bugfix
---
## 목표
반품 전표(`src/invoice/credit-note.js`)의 환불 금액이 회계팀 계산과 맞지 않는 문제를 바로잡는다. 회계팀 기준으로 CN-0112(청구서 INV-2047의 반품)의 환불 합계는 19,180원인데, 현재 전표는 19,182원으로 2원 많다.

## 비목표
- 이미 발행·저장된 반품 전표의 `totals`는 다시 계산하거나 고치지 않는다. 새로 계산하는 전표부터 바뀐다.
- 청구서 계산(`src/invoice/total.js`)은 바꾸지 않는다.

## 원하는 결과
- `examples/CN-0112.json`(청구서 `examples/INV-2047.json`)으로 반품 전표를 새로 만들면 환불 합계가 19,180원이다.
- 반품 전표의 부가세가 청구서와 같은 방식(과세 줄마다 할인 후 공급가액의 10%를 원 미만 절사해 합산)으로 계산된다. 면세 줄은 부가세가 없고 영세율이면 0이다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] CN-0112 요청과 INV-2047로 `createCreditNote`를 호출하면 `totals.total`이 19,180이다
- [ ] 면세 줄이 있거나 `zeroRated`인 반품 전표의 부가세가 위 규칙대로 계산된다는 테스트가 있다
- [ ] 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 저장된 값을 그대로 돌려준다

## 제약
- (팀 지식 docs/knowledge/invoice/vat-per-line-floor.md) 부가세는 과세 줄마다 할인 후 공급가액(net)의 10%를 원 미만 절사해 합산한다. 합계에 한 번 반올림하지 않는다.
- (팀 지식 docs/knowledge/invoice/issued-invoice-totals-frozen.md) 발행되어 저장된 totals는 계산 방식이 바뀌어도 재계산하지 않는다.

## 추가 의견
- 요청 원문: 회계팀이 10월 반품 전표를 대조하다 환불 금액이 몇 원씩 어긋난다고 연락함.
