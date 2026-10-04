# fix: 부가세를 과세 줄마다 원 단위 버림 후 합산

## 요약
청구서와 반품 전표의 부가세를 회계팀 규칙(과세 줄마다 원 단위 버림 후 합산)으로 계산한다. INV-2031은 합계가 29,082원에서 29,079원이 된다.

## 원인
과세 공급가액 합계에 세율을 곱해 한 번만 `Math.round`했다. 줄 금액이 10원 단위인 청구서는 결과가 같아 기존 테스트가 잡지 못했다.

## 변경
- `src/invoice/total.js`: `lineVat`, `sumLineVat` 추가, `computeTotals`가 사용
- `src/invoice/credit-note.js`: `creditTotals`가 `sumLineVat` 사용
- 발행된 청구서의 저장된 `totals`, `src/format/`, 할인·공급가액·면세·영세율 판정은 바꾸지 않음
- `docs/knowledge/billing/vat-per-line-floor.md`: 부가세 규칙 기록

## 테스트
- `npm test`: 49 통과, 0 실패
- 추가: INV-2031(2,641원), 할인·면세 혼합, 반품 전표 줄별 버림. 수정 전 src로 되돌리면 실패
