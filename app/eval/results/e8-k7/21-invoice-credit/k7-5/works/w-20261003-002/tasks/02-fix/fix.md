## 재현
- 재현 절차: 저장소 루트에서 `createCreditNote(INV-2047, CN-0112)`를 실행(`examples/INV-2047.json`, `examples/CN-0112.json`)하고 `totals`를 출력한다.
- 결과: 재현됨
- 기대: 줄별 공급가액 9,236 / 6,127 / 2,075 → 부가세 923+612+207 = 1,742, 환불 합계 19,180원
- 실제: `{"supply":17438,"vat":1744,"total":19182}` — 환불 합계 19,182원

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 한 번 `Math.round`로 부가세를 계산해(줄별 버림 규칙 위반) 몇 원 차이가 난다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals` (`Math.round((taxable * VAT_RATE_PERCENT) / 100)`). 17,438×10% = 1,743.8 → 1,744, 줄별 버림 합은 1,742. 수정 후 값이 1,742로 바뀐 것을 테스트로 확인.
- 사람 추정 판정: 없음
- 기각한 가설: 금액 할인의 수량 비율 반올림(`returnedDiscount`)이 원인 — CN-0112는 박스테이프를 전량 반품해 할인이 1,500 그대로이고 퍼센트 할인은 청구서와 같은 방식이라 이 건의 오차와 무관. 규칙에 부분 반품 금액 할인의 반올림 지정이 없어 건드리지 않음.

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 부가세를 과세 줄별 `floor(net × 10 / 100)`의 합으로 변경. 영세율이면 0, 면세 줄은 제외. 저장된 `totals`를 읽는 `creditNoteTotals`는 그대로.
- test/credit-note.test.js — CN-0112 재현 테스트 추가.

## 재현 테스트
- 위치: test/credit-note.test.js `반품 부가세는 과세 줄별 버림의 합이다 (CN-0112)`
- 수정 전: 실패 (`npm test` → `not ok 6`, vat 1744 ≠ 1742)
- 수정 후: 통과 (`npm test` → pass 47, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 47개 통과, 0개 실패
- 실패 항목: 없음 (기존 테스트 변경 없음)
