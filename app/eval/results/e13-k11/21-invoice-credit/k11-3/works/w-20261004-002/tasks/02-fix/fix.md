## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`을 `createCreditNote`로 적용해 `totals`를 본다 (재현 테스트 `test/credit-note.test.js`의 CN-0112 테스트로 실행: `npm test`)
- 결과: 재현됨
- 기대: 공급가액 17,438 / 부가세 1,742 (줄별 923+612+207) / 합계 19,180
- 실제: 부가세 1,744 / 합계 19,182

## 원인
- 원인: `creditTotals`가 부가세를 과세분 공급가액 합에 한 번 `Math.round`로 계산해, 팀 규칙(할인 후 줄별 `Math.floor` 합)과 몇 원씩 어긋난다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`에서 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. CN-0112 줄 공급가액 9236, 6127, 2075 (합 17438)에 대해 반올림은 1744, 줄별 버림은 1742. 수정 후 값이 바뀌는 것을 테스트로 확인(수정 전 실패, 후 통과). 줄이 하나이거나 줄별 부가세에 소수가 없으면 두 방식이 같아 어긋나지 않는다(기존 테스트가 통과한 이유).
- 사람 추정 판정: 없음
- 기각한 가설: 금액 할인의 수량 비율 분할(`returnedDiscount`의 `Math.round`) 때문 — CN-0112의 금액 할인 줄(OF-1342)은 전량 반품이라 분할이 일어나지 않고, 원인은 부가세 반올림이다. 비율 할인(OF-2150, 322.5→323)은 청구서의 `lineDiscount`와 같은 `percentOf` 반올림이라 청구서와 동일한 규칙이며 규칙 문서가 할인 반올림을 따로 정하지 않아 바꾸지 않았다.

## 변경 요약
- `src/invoice/credit-note.js` — `creditTotals`의 부가세를 과세 줄마다 `Math.floor(net × 10 / 100)` 합으로 변경. 영세율은 0, 면세 줄은 제외 유지.
- `test/credit-note.test.js` — 테스트 3개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/credit-note.test.js` "부가세는 줄별 원 단위 버림 합이다 (CN-0112)", 영세율/면세 테스트, 저장된 totals 테스트
- 수정 전: 실패 (`npm test` → CN-0112 테스트 not ok, 부가세 1744 ≠ 1742; 48 pass / 1 fail)
- 수정 후: 통과 (`npm test` → 49 pass / 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 49 통과, 0 실패
- 실패 항목: 없음
