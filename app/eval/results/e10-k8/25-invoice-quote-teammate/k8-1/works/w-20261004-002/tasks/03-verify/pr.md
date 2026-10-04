# fix: 반품 전표 부가세를 할인 후 과세 줄마다 버림으로 계산

## 요약
반품 전표의 환불 금액이 회계팀 계산과 몇 원씩 어긋나던 문제를 고쳤다. CN-0112(INV-2047의 반품)는 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 과세 합계 17,438에 10%를 곱해 `Math.round`로 한 번에 계산해 부가세가 1,744원이 나왔다. 회계 규칙은 할인 후 과세 줄마다 원 단위 버림으로 계산해 합산하는 것이다(923 + 612 + 207 = 1,742).

## 변경
- `src/invoice/credit-note.js` `creditTotals`: 부가세를 과세 줄마다 `Math.floor`로 계산해 합산. 영세율은 0, 면세 줄은 제외, `creditNoteTotals`의 저장값 우선은 그대로
- `test/credit-note.test.js`: CN-0112 재현 테스트 추가
- `src/format/`, 청구서(`total.js`), 견적(`quote.js`)은 바꾸지 않았다

## 테스트
- `npm test`: 49개 통과
- CN-0112를 `createCreditNote`로 직접 만들어 vat 1,742, total 19,180 확인
