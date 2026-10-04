## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`을 `createCreditNote`로 적용하고 `totals`를 출력 (`node` 스크립트로 실행)
- 결과: 재현됨
- 기대: vat 1,742 / total 19,180 (줄별 버림 합산: 923 + 612 + 207)
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 `Math.round(taxable * 10 / 100)`를 해서(합계 기준 반올림) 줄별 버림 합산 규칙과 어긋난다. 17,438 × 10% = 1,743.8 → 1,744.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 vat 줄. 줄별 net은 9236, 6127, 2075 → floor(923.6)+floor(612.7)+floor(207.5) = 1742. 수정 후 vat 1742로 바뀌고 재현 테스트가 통과함(실험으로 확인). 면세·영세율은 기존에도 0이라 어긋나지 않는다.
- 사람 추정 판정: 없음
- 기각한 가설: `returnedDiscount`의 Math.round 어긋남 — CN-0112에서는 금액 할인 줄이 전량 반품(1500 그대로)이고 비율 할인은 `percentOf`로 청구서와 같은 반올림 규칙(322.5→323)을 쓰므로 어긋남 원인이 아님. 팀 규칙에도 할인 반올림 규정은 없음.

## 변경 요약
- `src/invoice/total.js` — `lineVat(row, zeroRated)` 추가: 과세 줄만 `Math.floor(net * 10 / 100)`, 면세·영세율은 0
- `src/invoice/credit-note.js` — `creditTotals`가 줄마다 `lineVat`을 합산하도록 변경, 안 쓰는 `VAT_RATE_PERCENT` import 제거. `creditNoteTotals`는 이미 저장값을 그대로 돌려주므로 변경 없음
- `computeTotals`는 비목표라 건드리지 않음

## 재현 테스트
- 위치: `test/credit-note.test.js` — 'CN-0112' 테스트(실제 예시 파일 사용), 면세·영세율 0 테스트
- 수정 전: 실패 (`npm test` → `not ok 6 - 반품 전표 부가세는 과세 줄마다 버림 후 합산한다 (CN-0112)`, pass 47 / fail 1)
- 수정 후: 통과 (`npm test` → pass 48 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0개 실패
- 실패 항목: 없음
