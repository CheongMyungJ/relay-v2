# fix: 반품 전표 부가세를 과세 줄마다 원 단위 버림 후 합산

## 요약
반품 전표의 환불 금액이 회계팀 대조 기준과 몇 원씩 어긋나던 문제를 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 과세 공급가액 합계에 `Math.round(taxable * 10 / 100)`를 적용했다(합계 기준 반올림). 회계팀 기준은 줄마다 버림 후 합산이라 17,438 × 10% = 1,743.8 → 1,744로 어긋났다.

## 변경
- `src/invoice/total.js`: `lineVat(row, zeroRated)` 추가. 과세 줄만 `Math.floor(net * 10 / 100)`, 면세·영세율은 0
- `src/invoice/credit-note.js`: `creditTotals`가 줄마다 `lineVat`을 합산. 쓰지 않는 `VAT_RATE_PERCENT` import 제거
- 청구서 `computeTotals`, `src/format/`, 저장된 `totals`를 쓰는 `creditNoteTotals`는 변경 없음

## 테스트
- `npm test`: 48개 통과
- 추가: CN-0112 실제 예시 파일로 vat 1742 / total 19180 확인, 면세 줄·영세율 vat 0 확인
- 재현 절차를 직접 실행해 `{ vat: 1742, total: 19180 }` 확인
