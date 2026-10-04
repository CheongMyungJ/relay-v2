## docs/knowledge/invoice/format-output-is-fixed.md

---
kind: fact
source: human
---
# PDF 생성기는 src/format/ 서식 모듈의 출력을 그대로 찍는다

## 내용
- `src/format/`의 출력 형식을 바꾸면 PDF가 바뀐다. 금액 계산을 고칠 때도 서식 출력 형식은 유지한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/format-output-unchanged.md

---
kind: rule
source: human
---
# src/format/ 서식 모듈의 출력 형식은 바꾸지 않는다

## 규칙
- PDF 생성기가 `src/format/` 서식 모듈의 출력을 그대로 찍는다. 금액 계산을 고쳐도 서식 출력의 형식(줄 구성, 문구)은 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/issued-invoice-totals-stored.md

---
kind: rule
source: human
---
# 발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다

## 규칙
- 이미 발행된 청구서(와 저장된 `totals`가 있는 반품 전표)는 계산 규칙이 바뀌어도 다시 계산하지 않고 저장된 합계를 그대로 쓴다.
- 저장된 합계가 없는 초안 청구서나 반품 전표는 현재 규칙으로 계산된다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/issued-totals-not-recomputed.md

---
kind: rule
source: human
anchor: invoiceTotals
---
# 발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다

## 규칙
- 발행(`issueInvoice`) 때 계산해 저장한 `totals`를 그 뒤로 그대로 쓴다. 계산 규칙이 바뀌어도 이미 발행된 청구서의 합계는 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/invoice/vat-per-line-floor.md

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 과세 줄마다 원 단위 내림해 합산한다

## 규칙
- 부가세는 과세 줄마다 할인된 줄 공급가액의 10%를 원 단위로 내림(`lineVat`)하고, 그 합(`sumLineVat`)을 쓴다. 합계에서 다시 반올림하지 않는다 (회계팀 방식).
- 청구서, 반품 전표, 견적서 모두 `src/invoice/vat.js`의 `lineVat`/`sumLineVat`을 쓴다. 영세율(`zeroRated`)이면 0, 면세 줄은 제외한다.
- 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다. 견적서도 같다.
- 예: INV-2031 부가세 2,641원, 합계 29,079원.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001). 이전에는 과세 합계에 한 번 반올림했고 견적서는 할인 전 금액 기준이었다.
