## docs/knowledge/invoice/issued-invoice-totals-and-format.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 발행된 청구서는 재계산하지 않고, src/format/ 출력 형식은 바꾸지 않는다

## 규칙
- 발행된 청구서는 합계를 다시 계산하지 않고 저장된 `totals`를 쓴다 (`invoiceTotals`). 계산 규칙이 바뀌어도 발행분에는 소급하지 않는다.
- `src/format/` 출력 형식은 PDF 생성기가 쓰므로 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: computeTotals
---
# 청구서 부가세는 줄마다 원 단위 버림 후 합산한다

## 규칙
- 부가세는 품목 줄마다 (할인 적용 후 과세 공급가액 × 세율)을 원 단위로 버림(`Math.floor`)해 구하고, 그 합을 청구서 부가세로 쓴다. 합계에서 다시 반올림하지 않는다 (회계팀 방식).
- 할인은 부가세 전에 줄마다 적용한다. 면세 줄은 합산에서 제외하고, 영세율 청구서는 0이다.
- 예: INV-2031은 줄별 536+633+325+837+310 = 2,641원, 합계 29,079원 (합계 기준 반올림이면 2,644원).

## 아직 규칙을 따르지 않는 곳
- src/invoice/credit-note.js: `creditTotals`는 아직 합계 기준 `Math.round`라 청구서와 계산 방식이 다르다 (이번 Work에서는 범위 밖으로 둠).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
