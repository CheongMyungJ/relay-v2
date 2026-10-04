## 재현
- 재현 절차: `createInvoice(JSON.parse(examples/INV-2031.json))`를 `computeTotals`에 넣어 출력 (`node /tmp/r.mjs examples/INV-2031.json`)
- 결과: 재현됨
- 기대: vat 2,641 (536+633+325+837+310), total 29,079
- 실제: vat 2,644, total 29,082

## 원인
- 원인: 부가세를 과세 공급가액 합계에 세율을 곱해 한 번만 반올림(`Math.round`)했다. 회계팀 규칙은 줄마다 버림 후 합산이다. 반품 전표도 같은 식이었다.
- 근거: `src/invoice/total.js:26`, `src/invoice/credit-note.js:90`. 수정 전 INV-2031 vat 2,644, 수정 후 2,641로 바뀜(수정 전후 실행 비교). 줄 금액이 모두 10원 단위로 떨어지는 청구서는 합계 반올림과 줄별 버림이 같아 기존 테스트가 통과했다.
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 합계 기준 반올림이 원인이고, 줄별 버림으로 바꿔야 한다.
- 기각한 가설: 할인 처리 오류 — 기각. 할인은 `lineAmounts`에서 줄마다 이미 적용되어 net에 반영된다. 발행 청구서 재계산 — 기각. `invoiceTotals`(`src/invoice/invoice.js:41`)와 `creditNoteTotals`는 저장된 totals를 그대로 쓴다.

## 변경 요약
- src/invoice/total.js — `lineVat`(줄별 버림), `sumLineVat` 추가, `computeTotals`가 사용
- src/invoice/credit-note.js — `creditTotals`가 `sumLineVat` 사용, 불필요해진 `VAT_RATE_PERCENT` import 제거
- test/total.test.js, test/credit-note.test.js — 테스트 추가만 함(기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/total.test.js (INV-2031, 할인·면세 혼합), test/credit-note.test.js (반품 전표 줄별 버림)
- 수정 전: 실패 (src만 되돌리고 `npm test`: 46 통과, 3 실패)
- 수정 후: 통과 (`npm test`: 49 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`
- 결과: 49 통과, 0 실패
- 실패 항목: 없음
