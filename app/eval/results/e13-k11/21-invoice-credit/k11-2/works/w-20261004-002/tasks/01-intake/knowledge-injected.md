## docs/knowledge/invoice/issued-totals-and-format-frozen.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 발행된 청구서는 다시 계산하지 않고, `src/format/` 출력은 바꾸지 않는다

## 규칙
- 이미 발행된 청구서와 저장된 금액(`totals`)이 있는 반품 전표는 다시 계산하지 않고 저장된 합계를 그대로 쓴다(`invoiceTotals`, `creditNoteTotals`).
- `src/format/` 출력은 PDF 생성기가 그대로 찍으므로 형식을 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 줄마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 할인은 부가세 전에 품목 줄마다 적용한다.
- 부가세는 할인된 과세 줄 금액에 줄마다 원 단위 버림(`lineVat`, `src/invoice/total.js`)으로 계산해 합산한다. 합계에서 다시 반올림하지 않는다.
- 청구서(`computeTotals`)와 반품 전표(`creditTotals`, `src/invoice/credit-note.js`) 모두 같은 규정이다. 영세율은 부가세 0원, 면세 줄은 제외한다.
- 예: INV-2031 부가세 536+633+325+837+310=2,641원, 합계 29,079원.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
