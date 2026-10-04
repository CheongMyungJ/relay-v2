## 재현
- 재현 절차: `examples/INV-2031.json`의 lines로 `createInvoice` 후 `computeTotals` 실행 (워크트리에서 `node` 스크립트)
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 부가세를 한 번만 `Math.round`로 계산(2643.8→2644)했다. 회계팀 규칙은 줄마다 버림 후 합산이다.
- 근거: `src/invoice/total.js`의 기존 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 줄별 버림은 536+633+325+837+310=2,641. 수정 후 실행 결과 2,641/29,079 확인. 같은 공식이 `src/invoice/credit-note.js` `creditTotals`에도 있었다.
- 사람 추정 판정: 반올림 문제 같다 — 부분적으로 맞음. 반올림(round)이 원인의 일부이나, 핵심은 합계에 한 번 계산한다는 점과 반올림 대신 버림이어야 한다는 규칙 차이다.
- 기각한 가설: 없음

## 변경 요약
- src/money.js — `floorPercentOf`(원 단위 버림 비율 계산) 추가
- src/invoice/total.js — 부가세를 과세 줄마다 `floorPercentOf(net, 10)` 후 합산. 영세율은 0 유지
- src/invoice/credit-note.js — 사람이 "반품 전표도 같이 고친다"고 답해 같은 방식으로 변경(`creditTotals`)
- test/total.test.js, test/credit-note.test.js — 테스트 추가(기존 테스트는 변경 없음)

## 재현 테스트
- 위치: `test/total.test.js`(INV-2031, 할인 줄, 면세 줄), `test/credit-note.test.js`(반품 부가세)
- 수정 전: 실패 (`git checkout HEAD -- src` 후 `npm test`: 4개 실패, pass 46)
- 수정 후: 통과 (`npm test`: pass 50, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0 실패
- 실패 항목: 없음 (`src/format/`은 변경 없음)
