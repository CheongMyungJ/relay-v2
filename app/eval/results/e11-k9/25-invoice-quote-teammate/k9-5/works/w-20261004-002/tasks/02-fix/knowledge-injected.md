## docs/knowledge/billing/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 할인된 줄 금액에 줄마다 원 단위 버림으로 계산해 합한다

## 규칙
- 할인은 부가세 전에 품목 줄마다 적용하고, 부가세는 할인된 줄 금액(과세 줄만)에 매긴다.
- 줄마다 `Math.floor(net * 10 / 100)`(원 단위 버림)으로 계산하고, 청구서 부가세는 줄별 부가세의 합이다. 합계에서 다시 반올림하지 않는다.
- 청구서(`computeTotals`), 견적(`quoteTotals`), 반품 전표(`creditTotals`) 모두 `src/invoice/total.js`의 `lineVat`/`sumLineVat`을 쓴다. 새 문서 종류도 같은 함수를 쓴다.
- 영세율(`zeroRated`)과 면세 줄의 부가세는 0이다.
- 예: INV-2031 공급가액 26,438원, 부가세 2,641원, 합계 29,079원 (회계팀 합계와 일치).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
