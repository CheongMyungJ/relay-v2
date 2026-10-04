## docs/knowledge/points/earn-base-and-rounding.md

---
kind: rule
source: investigation
anchor: earnPoints
---
# 일반 주문 적립 포인트는 배송비를 뺀 결제 금액의 1%이고 원 미만은 버린다

## 규칙
- 적립 기준은 `amounts.total - amounts.shipping`이고, 적립률은 `POINT_RATE_PERCENT`, 원 미만은 버린다(`Math.floor`). 예: O-1042는 23770원 → 237P (반올림이면 238P).
- 이 기준은 고객센터 계산에서 O-1042 한 건(237P)으로 역산한 것이다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: 배송비 포함 금액을 `percentOf`(반올림)로 계산함. 사람이 Work w-20261004-001의 범위에서 뺌(2026-10-04)
- src/orders/refund.js:34: 부분 환불 회수 포인트가 `percentOf`(반올림)를 씀. 적립 방식과 다를 수 있음. 이 Work에서 손대지 않음(2026-10-04)

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/points/stored-points-earned.md

---
kind: rule
source: human
anchor: points.earned
---
# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 `points.earned`를 쓴다

## 규칙
- 영수증, 환불(`cancelOrder`) 등은 주문에 저장된 `points.earned`를 그대로 쓴다. 적립 계산식이 바뀌어도 저장된 값을 다시 계산하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
