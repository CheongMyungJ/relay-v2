## docs/knowledge/points/order-earn-points.md

---
kind: rule
source: human
anchor: earnPoints
---
# 일반 주문 적립 포인트는 (상품−쿠폰−사용 포인트)의 1%를 버림한다

## 규칙
- 일반 주문(O-)의 적립 기준 금액은 상품 금액 − 쿠폰 할인 − 사용 포인트이며 배송비는 포함하지 않는다.
- 적립 포인트는 기준 금액의 1%(`POINT_RATE_PERCENT`)를 원 단위 미만 버림한다. 예: O-1042는 23,770원 → 237P (반올림이면 238P).
- 적립 값은 주문 생성 때 `points.earned`에 저장하고, 영수증·환불·내역은 저장된 값을 쓴다.

## 아직 규칙을 따르지 않는 곳
- src/orders/refund.js: 부분 환불 `pointsRecovered`가 `percentOf(refundGoods, ...)` 반올림이라 적립 규칙(버림)과 다를 수 있다.
- src/gift/gift-points.js: 선물 적립은 `total` 기준 반올림이다. 선물 규칙은 이번 Work의 비목표라 사람 확인 전에는 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/points/percent-of-rounding.md

---
kind: pitfall
source: investigation
anchor: percentOf
---
# percentOf(src/money.js)는 반올림이며 여러 곳이 공유한다

## 내용
- `percentOf`는 `Math.round`로 반올림한다. 선물 적립(`giftPoints`)과 부분 환불 회수 포인트(`refund.js`)가 쓴다.
- 이것을 버림으로 바꾸면 선물과 환불 값이 함께 바뀐다. 일반 주문 적립은 `earnPoints`에서 따로 버림 계산한다(규칙은 docs/knowledge/points/order-earn-points.md 참고).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
