## docs/knowledge/accounting/vat-rounding.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: floorPercentOf
---
# 부가세는 품목 줄마다 원 단위 버림으로 계산해 더한다

## 규칙
- 부가세는 과세 품목 줄마다 원 단위 버림(`floorPercentOf`)으로 계산하고 그 합을 부가세로 쓴다. 합계에서 다시 반올림하지 않는다.
- 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 매긴다.
- 청구서(`computeTotals`)·견적(`quoteTotals`)·반품 전표(`creditTotals`) 모두 같은 규정이다.
- 예: INV-2031 부가세 2,641원, 합계 29,079원 (줄별 반올림 29,084, 합계 한 번 버림 29,081은 틀림).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/issued-invoice-and-format.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 발행된 청구서는 재계산하지 않고, src/format/ 출력은 PDF 생성기가 그대로 찍는다

## 규칙
- 발행된 청구서는 저장된 합계(`invoiceTotals`)를 쓰고 다시 계산하지 않는다. 계산 규칙이 바뀌어도 발행분은 그대로다. 예: INV-2047은 저장값 63,807원이고 지금 규칙으로 다시 계산하면 63,804원이다.
- `src/format/`의 출력 형식은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
