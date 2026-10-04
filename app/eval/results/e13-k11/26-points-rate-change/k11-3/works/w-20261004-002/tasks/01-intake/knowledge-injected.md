## docs/knowledge/points/earn-basis.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 (상품 − 쿠폰 − 사용 포인트)의 1%를 버림한다

## 규칙
- 적립 = (상품 금액 − 쿠폰 − 사용 포인트) × `POINT_RATE_PERCENT`%, 배송비 제외, 소수점 버림. 고객센터 적립 안내 기준이다. 예: O-1042는 23,770원 × 1% = 237.7 → 237P.
- 일반 주문과 선물하기 적립은 `earnPoints`(`src/points/earn.js`) 한 곳을 쓴다.
- 부분 환불 회수(`src/orders/refund.js`)도 버림으로 계산한다. 환불 전후 남은 주문의 적립(순 금액 기준) 차이로 구해 여러 번 나눠 환불해도 합계가 어긋나지 않는다.
- 이미 저장된 `points.earned`와 ledger는 다시 계산하지 않는다. 전체 취소는 저장된 값을 쓴다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
