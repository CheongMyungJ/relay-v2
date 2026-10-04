## docs/knowledge/invoice/issued-invoice-stored-totals.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다

## 규칙
- 이미 발행되어 저장된 청구서는 금액을 다시 계산하지 않고 저장된 합계를 그대로 쓴다. 계산 규칙이 바뀌어도 마찬가지다.
- `src/format/`의 출력 형식은 PDF 생성기가 그대로 찍으므로 바뀌면 안 된다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: sumLineVat
---
# 부가세는 과세 줄마다 원 단위 버림하고 그 합이 부가세다

## 규칙
- 청구서 부가세는 과세 품목 줄마다 (할인 후 줄 금액 × 세율)을 원 단위로 버림하고, 그 합이 청구서 부가세다. 합계에서 다시 반올림하지 않는다 (회계팀 규정). 예: INV-2031은 536+633+325+837+310 = 2,641원.
- 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 매긴다.
- 면세 품목과 영세율(`zeroRated`)은 부가세 0원이다.
- 반품 전표 부가세(`creditTotals`)도 같은 규칙을 쓴다. 계산은 `src/invoice/total.js`의 `sumLineVat` 한 곳에 둔다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
