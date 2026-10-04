## 재현
- 재현 절차: `createInvoice(examples/INV-2031.json)`을 `computeTotals`에 넣는다 (`node /tmp/claude-0/repro.mjs examples/INV-2031.json`)
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 부가세를 과세 공급가액 합에 `Math.round`로 한 번만 계산했다. 규정은 줄별 버림의 합이다.
- 근거: `src/invoice/total.js:24`(수정 전). 26,438×10%=2,643.8 → 반올림 2,644, 줄별 버림 합은 2,641. 수정 후 INV-2031이 2,641/29,079로 나옴. 반품 전표 `creditTotals`(`src/invoice/credit-note.js:90`)에 같은 식이 복사되어 있었다.
- 사람 추정 판정: "반올림 문제" — 맞음 — 합계에서 반올림(round)한 것이 원인이다. 다만 반올림을 버림으로 바꾸는 것만으로는 부족하고(2,643), 줄별로 계산해야 한다.
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/total.js` — `lineVat`(줄별 floor)와 `sumLineVat` 추가, `computeTotals`가 사용
- `src/invoice/credit-note.js` — `creditTotals`가 같은 `sumLineVat`을 쓰도록 변경 (사람이 같이 고치기로 선택)
- `test/total.test.js`, `test/credit-note.test.js` — 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: `test/total.test.js` 끝 3개(INV-2031 줄별 버림, 할인 줄, 면세 혼합), `test/credit-note.test.js` 끝 1개
- 수정 전: 실패 (`npm test` → 3 fail: total 신규 테스트 3개. 반품 테스트는 수정 전 실행 안 함)
- 수정 후: 통과 (`npm test` → 50 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
