## docs/knowledge/billing/issued-invoice-totals-frozen.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: fact
source: investigation
---
# 발행된 청구서는 저장된 totals를 쓰고 다시 계산하지 않는다

## 내용
- 발행된 청구서(status, totals가 있음)는 저장된 `totals`를 그대로 쓴다. 부가세 규칙을 바꿔도 재계산하지 않는다(`src/cli.js`).
- 그래서 INV-2047은 저장값 vat 5,801 / 합계 63,807이고, 줄별 버림으로 손계산한 5,798 / 63,804와 다르다. 이전 방식으로 발행된 결과라 예상된 차이다. 규칙은 `docs/knowledge/billing/vat-per-line-floor.md` 참고.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/billing/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 줄마다 원 단위 버림으로 계산해 합산한다 (회계팀 규칙)

## 규칙
- 부가세는 과세 품목 줄마다 계산하고 원 단위 미만을 버린다(`Math.floor`). 그 줄별 부가세의 합이 문서의 부가세이고, 합계에서 다시 반올림하지 않는다.
- 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액(과세 품목만)에 매긴다.
- 청구서, 견적서, 반품 전표는 `src/invoice/vat.js`의 `lineVat`/`sumLineVat` 한 곳을 같이 쓴다. 새 문서 종류도 이것을 쓴다.
- 면세 줄과 영세율 문서의 부가세는 0이다.
- 예: INV-2031은 536+633+325+837+310 = 2,641원, 공급가액 26,438원, 합계 29,079원.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
