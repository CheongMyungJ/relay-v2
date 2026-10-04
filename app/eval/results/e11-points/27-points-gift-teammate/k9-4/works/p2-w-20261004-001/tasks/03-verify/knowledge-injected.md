## docs/knowledge/points/earn-points-rule.md

---
kind: rule
source: human
anchor: earnPoints
---
# 일반 주문 적립 포인트는 배송비를 뺀 결제 금액의 1%, 원 단위 미만 버림

## 규칙
- 적립 포인트 = floor((total − shipping) × POINT_RATE_PERCENT / 100). 고객센터 기준이다. 예: O-1042 total 26,770, 배송비 3,000 → 237P (반올림이면 238P라 틀림).
- 공용 `percentOf`(반올림)는 적립 계산에 쓰지 않는다. 부분 환불의 회수 포인트(`src/orders/refund.js`)도 같은 버림으로 계산한다.
- 이미 저장된 `points.earned`는 다시 계산하지 않고 그대로 쓴다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: 배송비 포함, `percentOf` 반올림 그대로. 사람이 Work w-20261004-001의 범위에서 뺌(2026-10-04)

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
