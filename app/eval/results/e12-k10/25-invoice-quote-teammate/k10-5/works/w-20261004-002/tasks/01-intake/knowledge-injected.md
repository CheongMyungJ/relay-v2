## docs/knowledge/billing/vat-rounding.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: percentOfFloor
---
# 부가세는 과세 품목 줄마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 회계 규정: 부가세는 과세 줄마다 할인 후 공급가액(net)에 `VAT_RATE_PERCENT`를 곱해 원 단위로 버림(`percentOfFloor`)하고 합산한다. 합계에서 다시 반올림하지 않는다.
- 청구서(`computeTotals`), 반품 전표(`creditTotals`), 견적서(`quoteTotals`) 모두 같은 규칙이다. 면세 줄과 영세율은 부가세 0이다.
- 예: INV-2031 공급가액 26,438원, 줄별 부가세 536+633+325+837+310=2,641, 합계 29,079원.
- 이미 발행된 청구서는 저장된 `totals`를 그대로 쓰고 다시 계산하지 않는다(`invoiceTotals`).

## 바뀐 이력
- 2026-10-04 처음 남김. 합계에 한 번 `Math.round`하던 방식에서 줄별 버림으로 바뀜 (Work w-20261004-001, 사람이 알려 줌)
