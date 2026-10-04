## docs/knowledge/invoice/issued-totals-and-format.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 발행된 청구서는 저장된 합계를 쓰고, src/format/ 출력 형식은 바꾸지 않는다

## 규칙
- 이미 발행된 청구서와 반품 전표는 다시 계산하지 않고 저장된 `totals`를 그대로 쓴다 (`invoiceTotals`, `creditNoteTotals`).
- `src/format/`의 출력 형식은 바꾸지 않는다 (PDF 생성기가 그대로 찍는다).
- 계산 규칙(예: 부가세)이 바뀌어도 이미 저장된 합계는 고치지 않는다. 부가세 규칙은 docs/knowledge/invoice/vat-per-line-floor.md 참고.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: lineVatSum
---
# 부가세는 품목 줄마다 원 단위 버림으로 계산한 합이다 (회계팀 규정)

## 규칙
- 부가세는 과세 줄마다 할인된 줄 금액에 세율을 곱해 원 단위 미만을 버리고, 그 합을 청구서 부가세로 쓴다. 합계(공급가액 + 부가세)에서 다시 반올림하지 않는다.
- 할인은 부가세 전에 줄마다 적용한다. 부가세는 할인된 줄 금액에 매긴다.
- 면세 줄과 영세율 청구서의 부가세는 0이다.
- 청구서(`computeTotals`), 반품 전표(`creditTotals`), 견적(`quoteTotals`)은 `src/invoice/total.js`의 `lineVatSum` 하나를 함께 쓴다. 새 계산도 이 도우미를 쓴다.
- 예: INV-2031은 줄별 부가세 536·633·325·837·310 = 2,641원, 합계 29,079원.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌). 전체 한 번 반올림 → 줄별 버림 합
