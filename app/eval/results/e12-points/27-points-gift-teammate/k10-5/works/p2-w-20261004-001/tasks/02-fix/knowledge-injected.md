## docs/knowledge/points/earn-points-basis.md

---
kind: rule
source: investigation
anchor: earnPoints
---
# 적립 예정 포인트는 (상품 금액 − 쿠폰 − 사용 포인트)의 1%를 원 단위로 내림한다

## 규칙
- 적립 기준 금액은 `goods − coupon − pointsUsed`이고 배송비는 뺀다.
- 적립률(`POINT_RATE_PERCENT`, 1%)을 곱한 값은 원 단위로 내림한다. 반올림하지 않는다.
- 근거는 고객센터 계산 O-1042 = 237P 한 건이다 (상품 28,270 − 쿠폰 3,000 − 포인트 1,500 = 23,770, 1% = 237.7 → 237).
- 공용 `percentOf`(src/money.js)는 반올림이며 선물하기 적립과 환불 회수도 쓰므로 고치지 않고, 계산은 `src/points/earn.js` 안에서 한다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: 결제 금액(total)의 반올림 방식 그대로다. 다른 팀과 같이 보는 중이라 사람이 Work w-20261004-001의 범위에서 뺌(2026-10-04)
- src/orders/refund.js:34: 부분 환불 회수가 `percentOf(refundGoods)` 반올림이라 새 적립 규칙과 1P 어긋날 수 있다. (Work w-20261004-001)

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
