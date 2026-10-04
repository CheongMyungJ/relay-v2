## docs/knowledge/invoice/issued-invoice-no-recalc.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 쓴다

## 규칙
- 발행된 청구서는 재계산하지 않는다. 저장된 `totals`를 그대로 쓴다(`src/invoice/invoice.js`의 `invoiceTotals`는 draft가 아니고 저장된 totals가 있으면 그대로 돌려준다).
- 계산 규칙(부가세 등)이 바뀌어도 발행분 합계는 바뀌지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 청구서 부가세는 할인 후 줄 금액 기준 줄별 원 단위 버림 합이다

## 규칙
- 할인은 부가세 계산 전에 품목 줄마다 적용한다.
- 부가세는 할인된 줄 금액에 대해 품목 줄마다 원 단위 버림(`Math.floor`)으로 계산하고, 그 합을 청구서 부가세로 쓴다. 합계에서 다시 반올림하지 않는다.
- 면세 줄은 부가세에서 제외하고, 영세율(`zeroRated`) 청구서의 부가세는 0이다.
- 예: `examples/INV-2031.json`은 부가세 2,641원, 합계 29,079원이다 (공급가액 합 26,438원에 한 번 반올림하면 2,644원으로 틀린다).
- 구현: `src/invoice/total.js`의 `lineVat`/`computeTotals`.
- 발행된 청구서의 저장된 합계는 다시 계산하지 않는다(docs/knowledge/invoice/issued-invoice-no-recalc.md 참고).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
- 2026-10-04 src/invoice/credit-note.js creditTotals도 같은 계산(줄별 버림)으로 바꿈 (Work w-20261004-001, 사람 요청)
