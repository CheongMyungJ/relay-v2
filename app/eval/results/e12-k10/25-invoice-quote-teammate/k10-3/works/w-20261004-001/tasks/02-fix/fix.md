## 재현
- 재현 절차: `createInvoice`로 `examples/INV-2031.json`을 읽어 `computeTotals`를 호출한다 (스크립트: 임시 파일, 레포에 남기지 않음). 또는 `npm test`에 추가한 테스트를 수정 전 코드로 실행.
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계에 `Math.round`를 한 번 적용해 부가세를 계산했다. 회계팀 규칙은 줄마다 원 단위 버림이라, 줄별 소수 부분이 합계에서 반올림되며 몇 원 더 커진다.
- 근거: `src/invoice/total.js:26` (수정 전) `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 26,438×10% = 2,643.8 → 2,644, 줄별 버림 합은 2,641. 수정 후 INV-2031이 2,641 / 29,079가 됨 (실험으로 확인).
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 합계에 한 번 반올림하는 것이 원인이다.
- 기각한 가설: `money.js`의 `percentOf`(반올림) 때문 — `computeTotals`는 `percentOf`를 쓰지 않고 자체 `Math.round`를 쓴다. `percentOf`는 할인 계산(`discount.js`)에서만 쓰며 비목표라 건드리지 않음.

## 변경 요약
- `src/invoice/total.js` — vat를 과세 줄마다 `Math.floor(할인 후 금액 × 세율 / 100)` 후 합산으로 변경. 영세율은 0, 면세 줄은 합산에서 제외(0) 그대로.
- `test/total.test.js` — 테스트 2개 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/total.test.js` 마지막 두 테스트 (INV-2031 줄별 버림, 할인 후 금액 기준·면세 0)
- 수정 전: 실패 (`node --test test/total.test.js` → pass 5, fail 2)
- 수정 후: 통과 (같은 명령 → pass 7, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
