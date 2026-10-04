## 재현
- 재현 절차: `examples/INV-2031.json`을 `createInvoice` → `computeTotals`로 계산 (`node` 스크립트)
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: 부가세를 과세 공급가액 합계에 10%를 곱해 한 번에 반올림(`Math.round`)했다. 회계팀은 품목별로 버림 후 합산한다. 줄마다 소수점 이하가 생기는 청구서에서만 차이가 난다.
- 근거: `src/invoice/total.js` `computeTotals`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 반품 전표 `creditTotals`(`src/invoice/credit-note.js`)도 같은 식을 따로 갖고 있었다. INV-2031: 합계 2643.8 → 2,644, 품목별 버림 합 2,641. 수정 후 29,079 확인.
- 사람 추정 판정: "반올림 문제로 보이며 관련 코드는 `src/invoice/total.js`" — 맞음. 합계 기준 반올림이 원인이고 위치도 맞다. 다만 반품 전표(`credit-note.js`)에도 같은 식이 있었다.
- 기각한 가설: 발행된 청구서가 다시 계산될 가능성 — `invoiceTotals`(invoice.js)와 `creditNoteTotals`가 저장된 합계를 쓰므로 기각.

## 변경 요약
- src/invoice/total.js — `lineVat(net)` 추가(할인 후 줄 공급가액 × 10% 원 단위 버림). `computeTotals`는 과세 줄별 `lineVat`를 합산. 영세율은 0, 면세는 제외.
- src/invoice/credit-note.js — `creditTotals`도 `lineVat` 사용(사람이 반품 전표도 같이 고치기로 정함). 안 쓰게 된 `VAT_RATE_PERCENT` import 제거.
- test/total.test.js, test/credit-note.test.js — 테스트 추가. 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: test/total.test.js 새 테스트 2개(INV-2031, 할인 줄 버림), test/credit-note.test.js 전량 반품 1개
- 수정 전: 실패 (`git checkout src` 후 `npm test`: 46 통과, 3 실패)
- 수정 후: 통과 (`npm test`: 49 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`
- 결과: 49 통과, 0 실패
- 실패 항목: 없음 (`src/format/` 변경 없음)
