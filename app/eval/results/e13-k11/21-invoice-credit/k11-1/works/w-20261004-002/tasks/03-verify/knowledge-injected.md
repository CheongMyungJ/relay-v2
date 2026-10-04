## docs/knowledge/invoice/issued-invoice-stored-totals.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 쓴다

## 규칙
- 발행된 청구서는 저장된 합계를 그대로 쓴다. 계산 규칙(예: 부가세 줄별 버림, `docs/knowledge/invoice/vat-per-line-floor.md`)이 바뀌어도 재계산하지 않는다. 반품 전표도 이미 저장된 것은 같다.
- 새 규칙은 발행 전 초안과 새로 만드는 반품 전표에만 적용된다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 품목 줄마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 부가세는 줄마다 계산한다. 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액(과세 줄만)에 매기며 원 단위 미만은 버린다(`Math.floor`).
- 청구서 부가세는 줄별 부가세의 합이다. 합계에서 다시 반올림하지 않는다. 예: INV-2031(공급가액 26,438원)의 부가세는 536+633+325+837+310 = 2,641원, 합계 29,079원.
- 면세 줄과 영세율(`zeroRated`) 청구서의 부가세는 0원이다.
- 줄별 계산은 `src/invoice/total.js`의 `lineVat` 한 곳에 두고, 청구서(`computeTotals`)와 반품 전표(`creditTotals`)가 함께 쓴다. 부가세 식을 다른 곳에 복사하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
