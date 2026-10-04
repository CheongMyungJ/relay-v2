## docs/knowledge/points/earn-basis.md

---
kind: rule
source: human
anchor: earnPoints
---
# 적립 포인트 기준은 배송비를 뺀 결제 금액의 1%, 1P 미만 버림

## 규칙
- 적립 기준 금액은 상품 − 쿠폰 − 사용 포인트이며 배송비는 포함하지 않는다(`amounts.total − amounts.shipping`).
- 적립률은 `POINT_RATE_PERCENT`%이고 1P 미만은 버린다(반올림 아님). 예: O-1042는 23,770원 → 237.7 → 237P.
- 고객센터 계산 기준과 같다. 이미 적립된 값(`points.earned`)은 재계산하지 않고 주문에 저장된 값을 쓴다.

## 아직 정하지 않은 것
- 선물하기 적립(`src/gift/gift-points.js`)에 같은 기준을 적용할지: 사람이 따로 정한다. 지금 코드는 배송비 포함+반올림(Work w-20261004-001)

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
