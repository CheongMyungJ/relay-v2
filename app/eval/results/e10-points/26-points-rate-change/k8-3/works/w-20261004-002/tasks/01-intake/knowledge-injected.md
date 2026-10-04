## docs/knowledge/points/earn-base-and-rounding.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 금액의 적립률%를 원 단위 버림한다

## 규칙
- 적립 기준 금액은 상품 − 쿠폰 − 사용 포인트이고 배송비는 제외한다 (고객센터 적립 안내 기준).
- 적립 포인트는 기준 금액 × 적립률(`POINT_RATE_PERCENT`)%를 원 단위로 버림한다. 예: O-1042는 23,770원 × 1% = 237P.
- 계산은 `src/points/earn.js`의 `earnPoints` 한 곳이고, 선물하기(`giftPoints`)도 이를 호출한다. 반올림은 쓰지 않는다 (O-1042가 238P가 되어 안내 기준과 맞지 않음).
- 부분 환불 회수 포인트(`src/orders/refund.js`)도 같은 버림(`percentOfFloor`)을 쓴다.

## 아직 규칙을 따르지 않는 곳
- `src/orders/refund.js`: 회수 포인트의 기준이 상품 금액뿐이라 쿠폰·사용 포인트를 뺀 적립 기준 금액과 다르다. 쿠폰·포인트를 쓴 주문은 적립보다 많이 회수될 수 있다.
- 이미 저장된 주문의 `points.earned`는 옛 계산(배송비 포함, 반올림)이라 보정되지 않았다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
