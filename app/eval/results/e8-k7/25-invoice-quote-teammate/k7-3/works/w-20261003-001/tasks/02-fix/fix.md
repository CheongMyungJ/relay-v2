## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`
- 결과: 재현됨
- 기대: vat 2,641, total 29,079
- 실제: vat 2,644, total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 한 번만 `Math.round(×10%)`를 적용해, 줄별 버림 합(2,641)과 3원 차이가 난다.
- 근거: `src/invoice/total.js:28` (수정 전). 줄별 버림 합 536+633+325+837+310=2,641. 수정 후 CLI 출력 total 29,079 확인.
- 사람 추정 판정: "반올림 문제" — 맞음. 합계에 한 번 반올림(`Math.round`)하는 방식이 원인이고, 줄별 버림으로 바꾸어 해소됨.
- 기각한 가설: 발행분이 매번 재계산됨 — `invoiceTotals`(`src/invoice/invoice.js:41`)가 발행 이후 저장된 `totals`를 쓰므로 기각. 발행분은 영향 없음.

## 변경 요약
- `src/invoice/total.js` — 부가세를 과세 줄마다 `Math.floor(net × 10 / 100)` 후 합산. 영세율은 그대로 0.
- `test/total.test.js` — 줄별 버림 테스트 3개 추가 (INV-2031, 할인·면세 혼합, 영세율). 기존 테스트 변경 없음.

## 재현 테스트
- 위치: `test/total.test.js` 끝의 3개 테스트
- 수정 전: 실패 (`node --test test/total.test.js` → fail 2: INV-2031, 할인 혼합. 영세율은 원래 통과)
- 수정 후: 통과 (`node --test test/total.test.js` → pass 8, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: pass 51, fail 0
- 실패 항목: 없음
