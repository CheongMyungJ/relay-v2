## docs/knowledge/billing/vat-rounding.md

---
kind: rule
source: human
anchor: percentOfFloor
---
# 부가세는 과세 품목 줄마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 회계 규정: 부가세는 과세 줄마다 할인 후 공급가액(net)에 `VAT_RATE_PERCENT`를 곱해 원 단위로 버림(`percentOfFloor`)하고 합산한다. 합계에서 다시 반올림하지 않는다.
- 청구서(`computeTotals`)와 반품 전표(`creditTotals`)는 같은 규칙이다. 면세 줄과 영세율은 부가세 0이다.
- 예: INV-2031 공급가액 26,438원, 줄별 부가세 536+633+325+837+310=2,641, 합계 29,079원.
- 예: 반품 전표 CN-0112(INV-2047의 반품) 공급가액 17,438원, 줄별 부가세 923+612+207=1,742, 합계 19,180원.
- 이미 발행된 청구서는 저장된 `totals`를 그대로 쓰고 다시 계산하지 않는다(`invoiceTotals`). 반품 전표도 저장된 `totals`가 있으면 그대로 쓴다(`creditNoteTotals`).

## 아직 정하지 않은 것
- 견적서(`quoteTotals`)에 같은 규칙을 적용하는지: 이 Work에서는 확인하지 않았다(범위 밖). 앞 Work(w-20261004-001)가 견적서도 같은 규칙이라고 남겼으나 이 브랜치에서는 확인하지 못함. 지금 코드는 `Math.round`(Work w-20261004-002)
- 부분 반품 시 할인(`returnedDiscount`)의 반올림 규칙: 정해진 규칙이 없다. 지금 코드는 `percentOf`/`Math.round`(예: 형광펜 5% 할인 322.5→323)(Work w-20261004-002)

## 바뀐 이력
- 2026-10-04 처음 남김. 합계에 한 번 `Math.round`하던 방식에서 줄별 버림으로 바뀜 (Work w-20261004-001, 사람이 알려 줌)
- 2026-10-04 반품 전표(`creditTotals`)도 줄별 버림 합산으로 고침 (Work w-20261004-002)
