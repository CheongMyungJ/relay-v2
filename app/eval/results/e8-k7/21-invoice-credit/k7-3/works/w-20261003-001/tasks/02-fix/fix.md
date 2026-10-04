## 재현
- 재현 절차: `createInvoice(JSON.parse(fs.readFileSync('examples/INV-2031.json')))`를 `computeTotals`에 넣어 합계를 본다 (임시 스크립트 `/tmp/r.mjs`, `node /tmp/r.mjs`). 예제 파일은 `taxType`이 없어서 `createInvoice`로 정규화해야 과세 줄로 계산된다.
- 결과: 재현됨
- 기대: vat 2,641, total 29,079
- 실제: vat 2,644, total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 10%를 곱한 값(2,643.8)을 한 번 `Math.round`했다. 회계팀 규칙은 줄마다 원 단위 버림 후 합산이다.
- 근거: `src/invoice/total.js:31`(수정 전). 줄별 버림 합 536+633+325+837+310 = 2,641. 수정 전 실행 결과는 vat 2644, 수정 후 실행 결과는 vat 2641, total 29079이다. 합계 반올림을 줄별 버림으로 바꾸자 차이가 사라졌다(실험).
- 사람 추정 판정: "반올림 문제로 보인다. 코드는 `src/invoice/total.js`" — 맞음. 합계에 한 번 반올림하는 것이 원인이고, 위치도 맞다. 줄별 버림으로 바꾸면 해결된다.
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/total.js` — vat를 과세 줄마다 `Math.floor(net × 세율 / 100)`로 구해 합산한다. net은 줄마다 할인을 적용한 뒤의 금액이다. 면세 줄은 합산에서 빠지고 `zeroRated`는 계속 0이다.
- `test/total.test.js` — 재현 테스트 2개 추가. 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: `test/total.test.js` 끝의 두 테스트 (INV-2031 줄별 버림, 할인된 과세 줄 + 면세 줄 혼합)
- 수정 전: 실패 (`npm test`, 46 통과 / 2 실패: not ok 47, 48)
- 수정 후: 통과 (`npm test`, 48 통과 / 0 실패)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0개 실패
- 실패 항목: 없음 (`src/format/` 변경 없음)
