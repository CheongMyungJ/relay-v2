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

## docs/knowledge/points/refund-points-recovery.md (Work w-20261004-002에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: createRefund
---
# 부분 환불 회수 포인트는 원 적립 − 남은 상품 재계산 적립(1P 미만 버림)

## 규칙
- 부분 환불(`createRefund`, `src/orders/refund.js`)의 회수 포인트 = 주문에 저장된 원 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트. 정산팀 기준이다.
- 재계산 적립 = (남은 상품 금액 − 쿠폰 할인 − 사용 포인트) × `POINT_RATE_PERCENT`%, 배송비 제외, 1P 미만 버림(반올림 아님). 적립 기준 금액은 `docs/knowledge/points/earn-points-rule.md` 참고.
- 쿠폰 할인과 사용 포인트는 환불해도 남은 주문에 그대로 둔다.
- 예: O-1077의 R-0311은 403 − floor(27,180 × 1%) = 403 − 271 = 132P 회수. 환불 금액(`refundAmount`)은 13,130원 그대로.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-002)
