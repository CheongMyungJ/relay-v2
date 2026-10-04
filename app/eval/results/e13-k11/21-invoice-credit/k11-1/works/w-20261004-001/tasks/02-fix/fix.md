## 재현
- 재현 절차: `examples/INV-2031.json`을 `createInvoice`로 정규화한 뒤 `computeTotals` 실행 (`node /tmp/repro.mjs`). 예제 JSON은 `taxType`이 없어 정규화해야 과세로 계산된다.
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 부가세율을 곱해 한 번만 `Math.round`한다(2643.8→2644). 회계팀 규칙은 줄별 버림 합(2,641)이다.
- 근거: `src/invoice/total.js` 수정 전 `vat = Math.round(taxable * 10 / 100)`. 수정 뒤 INV-2031이 2,641/29,079로 나옴. 줄별 부가세 536+633+325+837+310=2,641. 반품 전표 `src/invoice/credit-note.js` `creditTotals`에 같은 식이 복사돼 있었음.
- 사람 추정 판정: "반올림 문제이며 `src/invoice/total.js` 쪽" — 맞음. 합계 한 번 반올림이 원인이고 위치도 맞다. 다만 같은 식이 `credit-note.js`에도 있었다.
- 기각한 가설: `money.js` `percentOf`/`discount.js` 반올림 — 할인이 없는 INV-2031에서도 재현되고 부가세는 이 함수를 쓰지 않아 기각.

## 변경 요약
- src/invoice/total.js — `lineVat`(할인 후 줄 금액, 과세 줄만, `Math.floor`, 영세율이면 0) 추가, `computeTotals`의 vat를 줄별 합으로 변경
- src/invoice/credit-note.js — 사람이 범위 확대를 선택해 `creditTotals`도 `lineVat` 합으로 변경
- test/total.test.js, test/credit-note.test.js — 테스트 추가(기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/total.test.js 3건(INV-2031 줄별 합, 할인 후 금액 기준, 면세/영세율), test/credit-note.test.js 1건
- 수정 전: 실패 (src를 HEAD로 되돌려 `npm test`: 4건 not ok, 기존 46건 통과)
- 수정 후: 통과 (`npm test`: 50 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 pass / 0 fail
- 실패 항목: 없음
