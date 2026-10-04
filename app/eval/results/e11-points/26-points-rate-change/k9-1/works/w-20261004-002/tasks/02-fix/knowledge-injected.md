## docs/knowledge/points/earn-points-basis.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 금액의 적립률%를 원 단위로 버림한다

## 규칙
- 적립 포인트 = (상품 금액 − 쿠폰 − 사용 포인트)의 `POINT_RATE_PERCENT`%를 원 단위로 버림한다. 배송비는 기준에서 뺀다. 예: O-1042는 23,770원 × 1% = 237.7 → 237P.
- 일반 주문, 선물하기(`giftPoints`는 `earnPoints`를 그대로 씀), 부분 환불 회수(`percentFloor`) 모두 같은 규칙을 따른다.
- 고객센터 안내 기준도 같다.

## 바뀐 이력
- 2026-10-04 처음 남김. 이전에는 배송비 포함 결제 금액을 반올림했다 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/points/partial-refund-recovery-not-proportional.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 부분 환불의 포인트 회수는 쿠폰·사용 포인트가 있으면 적립분과 비례하지 않는다

## 내용
- `src/orders/refund.js`의 `createRefund`는 환불 상품 금액의 적립률%(버림)를 회수한다. 쿠폰·사용 포인트를 안분하지 않는다.
- 예: 14,135원 × 2개, 쿠폰 3,000원, 포인트 1,500원이면 적립 237P인데 1개 부분 환불 시 141P를 회수한다(비례하면 약 118P).
- 안분 규칙은 정해진 바 없다. 고치려면 사람이 규칙을 먼저 정해야 한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
