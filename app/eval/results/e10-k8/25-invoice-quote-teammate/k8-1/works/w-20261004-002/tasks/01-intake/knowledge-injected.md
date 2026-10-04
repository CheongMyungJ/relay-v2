## docs/knowledge/format/output-frozen.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# `src/format/`의 출력 형식은 바꾸지 않는다

## 규칙
- PDF 생성기가 `src/format/`의 출력을 그대로 찍으므로 출력 형식을 바꾸면 안 된다. 계산 값이 바뀌어도 서식 코드는 건드리지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/invoice/issued-totals-are-stored.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 발행된 청구서와 반품 전표는 저장된 합계를 그대로 쓰고 재계산하지 않는다

## 규칙
- 발행된 청구서는 `invoiceTotals`(src/invoice/invoice.js)가 저장된 `totals`를 그대로 쓴다. 계산 규칙을 바꿔도 이미 발행된 것은 다시 계산하지 않는다.
- 반품 전표도 `creditNoteTotals`로 저장된 금액을 쓴다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 부가세는 할인 후 줄 금액마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 과세 줄 금액마다 `Math.floor(net * 10 / 100)`로 계산해 그 합을 부가세로 쓴다 (회계팀 규칙).
- 합계에서 다시 반올림하지 않는다. 예: INV-2031 부가세 2,641원, 합계 29,079원 (합계 반올림이면 2,644원).
- 청구서(`src/invoice/total.js` computeTotals), 견적(`quote.js` quoteTotals), 반품 전표(`credit-note.js` creditTotals)가 같은 규칙을 쓴다. 영세율은 부가세 0, 면세 줄은 부가세 제외.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌). 견적·반품 전표는 같은 Work의 리뷰에서 사람이 골라 함께 바꿨다
