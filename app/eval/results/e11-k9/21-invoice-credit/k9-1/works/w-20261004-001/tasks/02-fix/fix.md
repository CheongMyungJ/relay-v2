## 재현
- 재현 절차: `examples/INV-2031.json`의 `lines`로 `createInvoice({ customerId, lines })` 후 `computeTotals`를 호출 (임시 스크립트). 
- 결과: 재현됨
- 기대: vat 2,641원, total 29,079원
- 실제: vat 2,644원, total 29,082원

## 원인
- 원인: 부가세를 줄별로 계산하지 않고 과세 공급가액 합계(26,438)에 `Math.round`를 한 번 적용했다(10% → 2,643.8 → 2,644). 회계팀 규칙은 줄별 버림 합(536+633+325+837+310 = 2,641)이다.
- 근거: 수정 전 `src/invoice/total.js:30`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 수정 전 실행 결과 vat 2644, 수정 후 vat 2641 / total 29079. 수정 전 코드로 되돌려 새 테스트 3개 중 3개가 실패함을 확인(실험).
- 사람 추정 판정: "반올림 문제로 보인다. 관련 코드는 `src/invoice/total.js`" — 맞음 — 합계에 대한 단일 반올림이 원인이고 파일도 맞다. 다만 `percentOf`가 아니라 `total.js`의 인라인 `Math.round`이다.
- 기각한 가설: `percentOf`(`src/money.js`)의 반올림이 원인 — 청구서 부가세 경로는 `percentOf`를 쓰지 않고(할인 계산만 사용), 할인 없는 INV-2031에서도 재현되므로 기각.

## 변경 요약
- `src/invoice/total.js` — 과세 줄마다 할인 후 금액(`net`)에 `Math.floor(net * 10 / 100)`을 적용해 합산한 값을 `vat`로 사용. 영세율은 기존대로 0. 합계는 `supply + vat` 그대로.
- `test/total.test.js` — 테스트 3개 추가(기존 테스트 변경 없음).
- 반품 전표(`src/invoice/credit-note.js:90`)는 같은 방식의 `Math.round`를 쓰지만 사람이 "청구서만 고친다"고 답해 바꾸지 않았다.

## 재현 테스트
- 위치: `test/total.test.js` 끝의 3개 (INV-2031 줄별 버림, 할인 후 금액 기준, 면세·영세율 0원)
- 수정 전: 실패 (`npm test` → `not ok 47, 48, 49`, pass 46 / fail 3)
- 수정 후: 통과 (`npm test` → pass 49 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 중 49개 통과
- 실패 항목: 없음 (수정 전 기준 커밋에서 기존 46개 모두 통과)
