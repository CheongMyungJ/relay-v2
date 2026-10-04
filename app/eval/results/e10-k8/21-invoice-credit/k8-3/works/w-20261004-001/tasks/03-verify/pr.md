# fix: 청구서 부가세를 과세 줄마다 원 미만 절사해 합산

## 요약
청구서 부가세를 회계팀 방식(과세 줄마다 절사 후 합산)에 맞췄다. `INV-2031`은 29,082원에서 29,079원이 된다.

## 원인
`computeTotals`가 과세 공급가액 합계에 `Math.round`를 한 번만 적용했다(2,643.8 → 2,644). 회계팀은 줄마다 절사해 합산(2,641)한다.

## 변경
- `src/invoice/total.js`: `lineVatSum` 추가. 과세 줄의 할인 후 공급가액 × 10%를 줄마다 `Math.floor`해 합산. 면세 줄 제외, 영세율은 0 유지.
- `docs/knowledge/invoice/`: 줄별 절사 규칙과 발행 청구서 재계산 금지 규칙을 남김.
- 반품 전표(`credit-note.js`)와 `src/format/`은 바꾸지 않았다. 발행된 청구서는 저장된 totals를 쓴다.

## 테스트
- `npm test`: 50개 통과
- `node src/cli.js examples/INV-2031.json --totals`: vat 2,641 / total 29,079
- 추가 테스트 4개: 줄별 절사 합, 할인 후 기준, 면세 혼합, 영세율 0
