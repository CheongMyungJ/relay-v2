## 재현
- 재현 절차: `node` 로 `examples/INV-2031.json`을 `createInvoice` 후 `computeTotals` 실행 (또는 `node src/cli.js examples/INV-2031.json --totals`)
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 한 번만 10%를 곱해 반올림(`Math.round`)했다. 회계팀은 줄별로 내림해 합산한다.
- 근거: `src/invoice/total.js` 의 `vat` 계산. 줄별 내림: 536+633+325+837+310 = 2,641, 합계 기준 반올림 2,643.8→2,644. 수정 후 INV-2031이 2,641/29,079로 나옴.
- 사람 추정 판정: "반올림 문제 같다" — 부분적으로 맞음 — 반올림 규칙(반올림 vs 내림)과 합계 단위 vs 줄 단위 계산이 모두 달랐다.
- 기각한 가설: 없음

## 변경 요약
- src/invoice/total.js — vat를 과세 줄마다 `Math.floor(net*10/100)` 한 값의 합으로 계산. 영세율은 0, 면세 줄은 제외 유지.
- test/total.test.js — INV-2031 재현 테스트 추가 (기존 테스트는 변경 없음).

## 재현 테스트
- 위치: test/total.test.js "부가세는 과세 줄마다 원 단위 내림한 값의 합이다 (INV-2031)"
- 수정 전: 실패 (`npm test` → pass 48, fail 1)
- 수정 후: 통과 (`npm test` → pass 49, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패
- 실패 항목: 없음
