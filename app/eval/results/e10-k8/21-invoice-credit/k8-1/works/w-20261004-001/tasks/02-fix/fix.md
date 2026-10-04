## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 `Math.round(× 10 / 100)`를 한 번만 적용한다(2,643.8 → 2,644). 회계 규정은 줄마다 버림한 부가세의 합이다.
- 근거: `src/invoice/total.js` 옛 `vat` 줄. 줄별 버림 536+633+325+837+310 = 2,641. 수정 후 같은 명령이 2,641 / 29,079를 낸다. 반품 전표 `creditTotals`(`src/invoice/credit-note.js`)도 같은 식이었다. 줄 부가세가 모두 정수로 떨어지는 청구서(예: 61,670원 → 6,167)는 두 방식이 같아서 기존 테스트가 통과했다.
- 사람 추정 판정: "반올림 문제로 보인다" — 맞음. 합계에 한 번 반올림하는 것이 원인이다. 다만 반올림을 버림으로 바꾸는 것만으로는 부족하고(26,438 합계를 버림해도 2,643) 줄별로 계산해야 한다.
- 기각한 가설: 합계에서 Math.round를 Math.floor로만 바꾸기 — 2,643이 되어 기대값 2,641과 다름

## 변경 요약
- src/invoice/total.js — `lineVat`(할인된 줄 금액 × 세율, 원 단위 버림, 면세·영세율 0) 추가, `computeTotals`가 줄별 부가세의 합을 `vat`으로 사용
- src/invoice/credit-note.js — `creditTotals`도 `lineVat`을 써서 같은 규칙 적용 (사람이 범위 확대에 동의). 이미 저장된 전표 totals는 그대로 쓴다.
- test/total.test.js, test/credit-note.test.js — 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/total.test.js 새 3개, test/credit-note.test.js 새 1개
- 수정 전: 실패 — `npm test` 에서 4개 not ok (46 pass / 4 fail)
- 수정 후: 통과 — `npm test` 50 pass / 0 fail

## 테스트 실행
- 명령: `npm test`
- 결과: 50 pass, 0 fail
- 실패 항목: 없음
