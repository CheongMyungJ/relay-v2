## docs/knowledge/points/earn-basis.md

---
kind: rule
source: human
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀, 쿠폰·포인트 차감 후 상품 금액의 적립률을 원 단위 버림으로 계산한다

## 규칙
- 적립 기준 금액 = 상품 금액(goods) − 쿠폰 할인 − 사용 포인트. 배송비는 넣지 않는다.
- 적립 포인트 = 기준 금액 × POINT_RATE_PERCENT% 를 원 단위 미만 버림 (`floorPercentOf`). 예: O-1042는 (28,270 − 3,000 − 1,500) = 23,770원의 1% = 237.7 → 237P.
- 이미 적립된 주문은 저장된 `points.earned`를 그대로 쓰고 다시 계산하지 않는다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: 결제 금액(total)의 반올림 `percentOf`로 계산. 사람이 Work w-20261004-001의 범위에서 뺌(2026-10-04)
- src/orders/refund.js:34: 부분 환불 포인트 회수가 `percentOf(refundGoods)` 반올림, 쿠폰·포인트 차감 전 금액 기준. 적립 기준과 달라 적립보다 많거나 적게 회수될 수 있음

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
