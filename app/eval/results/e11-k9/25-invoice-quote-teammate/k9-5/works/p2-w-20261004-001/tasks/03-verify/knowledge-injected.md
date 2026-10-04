## docs/knowledge/billing/credit-note-stored-amounts.md

---
kind: rule
source: human
anchor: returnedDiscount
---
# 반품 전표: 저장 금액은 다시 계산하지 않고, 금액 할인은 수량 비율로 나눈다

## 규칙
- 이미 발행된 청구서와 이미 만든 반품 전표는 다시 계산하지 않고 저장된 `totals`를 그대로 쓴다.
- 금액 할인 줄을 일부만 반품할 때 할인을 수량 비율로 나누는 `returnedDiscount`의 방식은 회계팀과 맞춘 것이다.
- `src/format/`의 출력 형식은 금액 계산을 고치면서 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-002)

## docs/knowledge/billing/vat-per-line-floor.md

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 할인된 줄 금액에 줄마다 원 단위 버림으로 계산해 합한다

## 규칙
- 할인은 부가세 전에 품목 줄마다 적용하고, 부가세는 할인된 줄 금액(과세 줄만)에 매긴다.
- 줄마다 `Math.floor(net * 10 / 100)`(원 단위 버림)으로 계산하고, 청구서 부가세는 줄별 부가세의 합이다. 합계에서 다시 반올림하지 않는다.
- 청구서(`computeTotals`), 견적(`quoteTotals`), 반품 전표(`creditTotals`) 모두 `src/invoice/total.js`의 `lineVat`/`sumLineVat`을 쓴다. 새 문서 종류도 같은 함수를 쓴다.
- 반품 전표는 돌려받는 품목 줄마다 같은 방식으로 계산한다.
- 영세율(`zeroRated`)과 면세 줄의 부가세는 0이다.
- 예: INV-2031 공급가액 26,438원, 부가세 2,641원, 합계 29,079원 (회계팀 합계와 일치).
- 예: CN-0112(INV-2047 반품) 공급가액 17,438원, 부가세 1,742원, 환불 합계 19,180원.

## 아직 규칙을 따르지 않는 곳
- src/invoice/credit-note.js: `creditTotals`가 `lineVat`/`sumLineVat` 대신 줄별 `Math.floor`를 직접 계산한다. 앞 Work(w-20261004-001) 머지 전에 `total.js`에 공용 함수가 없어서 그렇게 했다. 머지 뒤 공용 함수로 바꾼다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
- 2026-10-04 반품 전표 `creditTotals`를 줄별 원 단위 버림으로 고침 (Work w-20261004-002)
