## docs/knowledge/points/earn-basis.md

---
kind: rule
source: investigation
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 결제 금액의 1%, 원 단위 미만 버림이다

## 규칙
- 적립 포인트 = `floor((상품 - 쿠폰 - 사용 포인트) × POINT_RATE_PERCENT / 100)`. 배송비는 기준에서 뺀다 (고객센터 기준, O-1042 = 237P).
- 이 기준은 고객센터 값 한 건(O-1042)으로 추정했다. 다른 주문의 고객센터 값은 확인하지 못했다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: `percentOf(total)` 반올림 그대로라 배송비가 포함된다. 사람이 Work w-20261004-001의 범위에서 뺌(2026-10-04). 다른 팀과 같이 보는 중
- src/orders/refund.js: `pointsRecovered`가 `percentOf(상품 금액)` 반올림이라 적립 기준과 다르다. 확인 필요

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
