## 재현
- 재현 절차: `INV-2047.json`과 `CN-0112.json`을 읽어 `createCreditNote(invoice, data).totals`를 출력한다 (워크트리 루트에서 `node` 스크립트 실행)
- 결과: 재현됨
- 기대: `{ supply: 17438, vat: 1742, total: 19180 }`
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 `Math.round`로 부가세를 한 번 계산한다. 규칙은 과세 줄마다 `floor(할인 후 금액 × 10 / 100)`을 구해 더하는 것이다.
- 근거: `src/invoice/credit-note.js` `creditTotals`. 줄별 계산: 923(9,236원) + 612(6,127원) + 207(2,075원) = 1,742. 합계 17,438 × 10% 반올림은 1,744. 줄별 버림으로 바꾸자 19,180이 나왔다(실험). 줄이 하나이고 10원 단위로 떨어지면 두 방식이 같아 재현되지 않는다.
- 사람 추정 판정: 없음
- 기각한 가설: 할인 계산(`returnedDiscount`)의 반올림 문제 — 줄별 할인 후 금액(공급가액 17,438)은 회계 기대 합계와 맞고 차이는 부가세 2원뿐이다.

## 변경 요약
- `src/invoice/credit-note.js` — 부가세를 과세 줄마다 할인 후 금액에 원 단위 버림으로 계산해 합산하도록 변경. `creditNoteTotals`는 이미 저장된 `totals`를 그대로 돌려주므로 그대로 둠. `src/format/`은 건드리지 않음.

## 재현 테스트
- 위치: `test/credit-note.test.js` — 'CN-0112 환불 금액…' (저장된 totals 유지 테스트도 추가)
- 수정 전: 실패 (`npm test`, CN-0112 테스트 not ok, pass 49 / fail 1)
- 수정 후: 통과 (`npm test`, pass 50 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
