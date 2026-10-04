## docs/knowledge/invoice/issued-invoice-and-format-output.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 발행된 청구서는 다시 계산하지 않고, src/format/ 출력은 바꾸지 않는다

## 규칙
- 이미 발행된 청구서는 합계를 다시 계산하지 않고 저장된 `totals`를 그대로 쓴다(`invoiceTotals`). 계산 규칙이 바뀌어도 발행분 금액은 바뀌지 않는다. draft 상태 청구서만 새 규칙으로 계산된다.
- `src/format/`의 출력 형식은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: computeTotals
---
# 청구서와 반품 전표의 부가세는 과세 줄마다 원 단위 버림 후 합산한다

## 규칙
- 회계 규정: 청구서(`computeTotals`)와 반품 전표(`creditTotals`) 모두 부가세는 과세 품목 줄마다 (할인 후 줄 금액 × 세율)을 원 단위로 버림(floor)해 계산하고, 그 합을 부가세로 쓴다.
- 합계(과세 공급가액 합)에서 부가세를 다시 계산하거나 반올림·절사하지 않는다. 예: INV-2031은 줄별 536+633+325+837+310 = 2,641원, 청구 합계 29,079원. 합계 기준 반올림은 2,644원, 합계 절사는 2,643원이라 둘 다 틀리다.
- 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 매긴다. 면세 줄과 영세율(`zeroRated`) 청구서의 부가세는 0이다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
- 2026-10-04 src/invoice/credit-note.js의 creditTotals를 규칙대로 고침 (Work w-20261004-001)
