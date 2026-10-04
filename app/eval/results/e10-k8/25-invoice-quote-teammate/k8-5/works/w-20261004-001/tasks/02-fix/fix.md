## 재현
- 재현 절차: `createInvoice`로 `examples/INV-2031.json`을 정규화한 뒤 `computeTotals`를 호출한다 (`node /tmp/r.mjs` 형태의 임시 스크립트). JSON을 정규화 없이 넣으면 `taxType`가 없어 전 줄이 면세로 처리되니 주의.
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 전체 합에 10%를 곱한 뒤 `Math.round` 한다(합계 단위 반올림). 회계 규정은 줄마다 원 단위 버림 후 합산이다. 줄별 소수점 버림이 합쳐지지 않고 합계에서 한 번 반올림되어 최대 몇 원 차이가 난다.
- 근거: `src/invoice/total.js:27`(수정 전). INV-2031은 26,438 x 10% = 2,643.8 -> 2,644, 줄별 버림 536+633+325+837+310 = 2,641. 수정 후 29,079 확인. 같은 방식이 `src/invoice/credit-note.js:90`(합계 반올림), `src/invoice/quote.js:40-44`(할인 전 금액과 할인액에 각각 반올림)에도 있었다.
- 사람 추정 판정: "반올림 문제" — 맞음(부분적). 합계 단위 반올림이 원인이며, 줄별 버림(반올림 아님)으로 바꿔야 한다. 수정 후 INV-2031이 29,079가 되는 것으로 확인.
- 기각한 가설: 없음

## 변경 요약
- src/invoice/total.js — `lineVat`(줄 공급가액 x 10% 버림), `sumLineVat`(과세 줄 합) 추가, `computeTotals`가 사용.
- src/invoice/credit-note.js — 사람 결정(범위 확대)에 따라 `creditTotals`도 `sumLineVat` 사용.
- src/invoice/quote.js — 사람 결정에 따라 `quoteTotals`도 `sumLineVat` 사용(기존 할인 전 금액 기준 계산 대체). 쓰지 않게 된 import 정리.
- test/total.test.js, test/quote.test.js, test/credit-note.test.js — 테스트 추가(기존 테스트는 변경 없음).
- 발행분: `invoiceTotals`/`creditNoteTotals`는 저장된 합계를 그대로 쓰므로 재계산되지 않음(코드 변경 없음). `src/format/`은 변경 없음.

## 재현 테스트
- 위치: test/total.test.js (INV-2031, 할인 줄), test/quote.test.js, test/credit-note.test.js
- 수정 전: 실패 (`npm test`: 새 테스트 4건 실패, 48건 통과 + 기존)
- 수정 후: 통과 (`npm test`: 52 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 52 pass / 0 fail
- 실패 항목: 없음
