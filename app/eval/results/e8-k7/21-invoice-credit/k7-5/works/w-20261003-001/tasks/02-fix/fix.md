## 재현
- 재현 절차: `createInvoice(examples/INV-2031.json)`을 `computeTotals`에 넣는다 (`node /tmp/r.mjs examples/INV-2031.json` 형태의 임시 스크립트).
- 결과: 재현됨
- 기대: vat 2,641, total 29,079
- 실제: vat 2,644, total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합(26,438)에 부가세를 한 번만 `Math.round`해(2,643.8 → 2,644) 줄별 버림 합(536+633+325+837+310=2,641)보다 커진다. 반품 전표 `creditTotals`도 같은 방식이다.
- 근거: 수정 전 `src/invoice/total.js` vat 계산 줄과 `src/invoice/credit-note.js:90`. 수정 전 출력 vat 2644, 수정 후 2641. 줄 금액에 소수 부분이 있는 경우에만 차이가 난다.
- 사람 추정 판정: "반올림 문제로 보인다" — 맞음 — 합계에 한 번 반올림하는 것이 원인이며, 줄별 버림으로 바꾸어 해소됨. (`src/invoice/total.js`가 위치도 맞음)
- 기각한 가설: 할인 적용 순서 문제 — 기각, 할인은 이미 줄별로 공급가액(net)에서 빠지고 INV-2031에는 할인이 없다.

## 변경 요약
- src/invoice/vat.js (신규) — 과세 줄마다 `floor(net*세율/100)`을 구해 합하는 `rowsVat`. 영세율이면 0.
- src/invoice/total.js — 부가세를 `rowsVat`으로 계산.
- src/invoice/credit-note.js — 사람이 "반품 전표도 줄별 버림으로 고침"을 선택해 같은 `rowsVat` 적용.
- test/total.test.js, test/credit-note.test.js — 테스트 추가 (기존 테스트 변경 없음).
- `src/format/` 변경 없음. 발행된 청구서는 `invoiceTotals`가 저장 합계를 쓰므로 다시 계산하지 않는다 (변경 없음).

## 재현 테스트
- 위치: test/total.test.js (INV-2031, 할인 줄), test/credit-note.test.js (반품 전표)
- 수정 전: 실패 — `src`를 되돌리고 `npm test`: 3개 실패 (pass 46 / fail 3)
- 수정 후: 통과 — `npm test`: pass 49 / fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0 실패
- 실패 항목: 없음 (기존 46개는 기준 커밋에서도 통과)
