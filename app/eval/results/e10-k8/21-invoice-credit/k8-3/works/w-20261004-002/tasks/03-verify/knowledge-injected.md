## docs/knowledge/invoice/issued-invoice-totals-frozen.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 발행된 청구서는 재계산하지 않고 저장된 totals를 쓴다

## 규칙
- 발행된 청구서의 금액은 발행 시 저장된 `totals`를 그대로 쓴다. 계산 방식(예: 부가세 절사)이 바뀌어도 다시 계산하지 않는다.
- 계산 방식을 바꾸면 새로 계산하는 청구서부터 값이 바뀐다. CSV, 분개, 월별 요약도 `invoiceTotals`를 거치므로 같다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: lineVatSum
---
# 부가세는 과세 줄마다 원 미만 절사해 합산한다

## 규칙
- 회계팀 방식: 과세 줄마다 할인 후 공급가액(net)의 10%를 원 미만 절사하고, 그 값을 합산한다. 합계에 한 번 반올림하지 않는다.
- 예: `examples/INV-2031.json`은 536+633+325+837+310 = 부가세 2,641원, 합계 29,079원이다.
- 면세 줄은 부가세가 없고, 영세율(`zeroRated`)이면 부가세 0이다.

## 아직 규칙을 따르지 않는 곳
- src/invoice/credit-note.js `creditTotals`: 부가세를 합계에 한 번 `Math.round`한다. 청구서와 1~3원 어긋날 수 있다. 사람이 이번 Work에서는 청구서만 고치기로 했다.

## 바뀐 이력
- 2026-10-04 처음 남김. 청구서 `computeTotals`(src/invoice/total.js)를 줄별 절사로 바꿈 (Work w-20261004-001, 사람이 알려 줌)
