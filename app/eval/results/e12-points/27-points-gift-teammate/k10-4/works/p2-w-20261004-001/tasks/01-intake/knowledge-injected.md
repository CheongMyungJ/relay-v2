## docs/knowledge/points/earn-rule.md

---
kind: rule
source: human
anchor: earnPoints
---
# 주문 적립 포인트는 (상품금액 - 쿠폰 - 사용 포인트)의 적립률에서 소수점을 버린다

## 규칙
- 적립 기준 금액은 상품금액 − 쿠폰 − 사용 포인트이다. 배송비는 뺀다.
- 적립 포인트는 기준 금액 × 적립률(`POINT_RATE_PERCENT`)에서 소수점을 버린다. 예: 23,770원 × 1% = 237.7 → 237P.

## 아직 정하지 않은 것
- 선물하기 적립(`src/gift/gift-points.js`)에도 이 규칙을 적용할지: 다른 팀과 같이 정한다. 지금 코드는 배송비 포함 total 기준 반올림(`percentOf`)이다(Work w-20261004-001)

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
