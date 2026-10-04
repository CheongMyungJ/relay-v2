## docs/knowledge/billing/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 할인 후 품목 줄마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 할인은 부가세 전에 품목 줄마다 적용한다. 부가세는 할인된 줄 금액에 줄마다 원 단위 버림(`Math.floor(net*10/100)`)으로 계산해 합산한다. 합계에서 다시 반올림하지 않는다 (회계팀 규칙).
- 청구서(`computeTotals`), 견적서(`quoteTotals`), 반품 전표(`creditTotals`)는 모두 `src/invoice/total.js`의 `lineVat`를 쓴다.
- 예: INV-2031(`examples/INV-2031.json`) 합계는 29,079원 (부가세 2,641원).
- 발행된 청구서는 발행 때 저장한 합계를 그대로 쓰고 다시 계산하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
