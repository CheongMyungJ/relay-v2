## docs/knowledge/billing/issued-invoice-stored-totals.md

---
kind: rule
source: human
---
# 발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다

## 규칙
- 발행된 청구서는 발행 때 저장된 `totals`를 그대로 쓴다(`invoiceTotals`). 계산 규정이 바뀌어도 다시 계산하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/billing/vat-per-line-floor.md

---
kind: rule
source: human
anchor: vatOfLines
---
# 부가세는 품목 줄마다 할인 후 금액에 원 단위 버림으로 계산해 합산한다

## 규칙
- 부가세는 과세 줄마다 할인 적용 후 줄 금액(net)에 `VAT_RATE_PERCENT`%를 곱해 원 단위 버림(`Math.floor`)하고, 그 합을 부가세로 쓴다. 합계에서 다시 반올림하지 않는다 (회계팀 규정).
- 청구서(`src/invoice/total.js`), 견적(`quote.js`), 대변전표(`credit-note.js`)가 모두 공용 함수 `src/money.js`의 `vatOfLines`를 쓴다. 새 계산 경로도 이 함수를 쓴다.
- 영세율(`zeroRated`) 문서는 부가세 0, 면세 줄은 부가세에 포함하지 않는다.
- 예: INV-2031은 줄별 536+633+325+837+310 = 부가세 2,641원, 합계 29,079원.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
