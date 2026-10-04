## docs/knowledge/billing/example-json-needs-normalize.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# examples/*.json은 createInvoice로 정규화해야 과세 구분이 채워진다

## 내용
- `examples/*.json`을 정규화 없이 `computeTotals`에 넣으면 `taxType`가 없어 전 줄이 면세로 계산된다. 재현이나 비교 스크립트에서는 먼저 `createInvoice`를 거친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/billing/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 할인된 줄 금액에 줄마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 회계팀 규정: 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액(공급가액)에 품목 줄마다 원 단위 버림으로 구한 값의 합이다. 합계에서 다시 반올림하지 않는다. 예: `examples/INV-2031.json`은 부가세 2,641원, 합계 29,079원.
- 청구서, 반품 전표, 견적서 모두 적용된다. 계산은 `src/invoice/total.js`의 `lineVat`/`sumLineVat`을 공유한다.
- 면세 줄과 영세율(`zeroRated`) 청구서의 부가세는 0이다.
- 새로 계산하는 문서부터 적용한다. 발행된 청구서와 반품 전표는 저장된 totals를 재계산하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
