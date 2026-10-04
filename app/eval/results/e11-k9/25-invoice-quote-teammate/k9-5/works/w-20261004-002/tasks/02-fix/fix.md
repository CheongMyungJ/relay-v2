## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`을 `createCreditNote`로 적용해 `totals`를 출력한다 (`node /tmp/repro.mjs`와 같은 스크립트)
- 결과: 재현됨
- 기대: vat 1,742, total 19,180
- 실제: vat 1,744, total 19,182

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 한 번만 `Math.round(taxable*10/100)`을 해서, 줄마다 버림하는 회계 규정과 어긋났다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`. CN-0112 줄별 공급가 9,236/6,127/2,075의 줄별 버림 합은 1,742이고, 합계 17,438의 반올림은 1,744다. 수정 뒤 19,180이 나옴.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/credit-note.js` — `creditTotals`의 부가세를 과세 줄마다 `Math.floor(net*10/100)`로 계산해 합하도록 바꿈. 영세율은 0. `returnedDiscount`는 그대로.
- `test/credit-note.test.js` — 줄별 버림 합을 확인하는 테스트 추가 (기존 테스트는 바꾸지 않음)

## 재현 테스트
- 위치: `test/credit-note.test.js` 마지막 테스트
- 수정 전: 실패 (`node --test test/credit-note.test.js` → fail 1, 합계 반올림으로 291)
- 수정 후: 통과 (같은 명령 → pass 6, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패
- 실패 항목: 없음
