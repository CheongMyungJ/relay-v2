## docs/knowledge/points/earn-base.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 금액의 1%를 원 단위로 버림한다

## 규칙
- 적립 기준 금액은 상품 금액 − 쿠폰 − 사용 포인트이고 배송비는 넣지 않는다.
- 적립 포인트는 기준 금액의 `POINT_RATE_PERCENT`%를 원 단위로 버림한다(반올림 아님). 예: 주문 O-1042는 기준 23,770원 → 237P.
- 주문 적립, 선물 적립, 환불 회수가 모두 `src/points/earn.js`의 기준(`earnBase`, `pointsForBase`, `earnPoints`)을 쓴다. 따로 계산하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌). 옛 기준은 배송비를 포함한 결제액을 반올림했다

## docs/knowledge/points/partial-refund-recovery.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: fact
source: investigation
---
# 부분 환불 회수 포인트는 환불 전후 적립 포인트의 차이다

## 내용
- `src/orders/refund.js`의 `createRefund`는 회수 포인트를 (환불 전 기준 금액의 적립) − (환불 후 기준 금액의 적립)으로 계산한다. 기준 금액과 버림은 `docs/knowledge/points/earn-base.md` 참고.
- 각 환불에 따로 1% 버림을 하면 나눠 환불한 합이 전체 적립과 어긋나서 차이 방식으로 했다. 쿠폰과 사용 포인트는 남은 주문에 남는다.
- 전체 취소(`cancelOrder`)는 저장된 `points.earned`를 그대로 회수한다.
- 주의: 옛 기준으로 저장된 과거 주문을 부분 환불하면 새 기준 회수 값이 저장 적립과 어긋날 수 있다(소급 수정은 하지 않기로 함).
