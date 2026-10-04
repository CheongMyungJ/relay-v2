## docs/knowledge/points/earn-points-rule.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 금액의 적립률, 원 단위 버림

## 규칙
- 적립 기준 금액은 상품 금액 − 쿠폰 할인 − 사용 포인트이다(배송비 제외). `src/points/earn.js`의 `earnBase`.
- 적립 포인트는 기준 금액 × `POINT_RATE_PERCENT`%를 원 단위로 버린 값이다. 예: O-1042는 기준 23,770원 → 237P.
- 적립 계산은 `earnPoints` 하나로 모으고 선물하기(`src/gift/gift-points.js`)도 이를 쓴다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
