## docs/knowledge/format/receipt-text-fixed.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 영수증 글자(src/format/)의 줄 차례와 칸 너비는 바꾸지 않는다

## 규칙
- 영수증 글자는 앱과 메일이 줄 단위로 그대로 보여 준다. `src/format/`의 줄 차례와 칸 너비를 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/points/earn-rule.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnBase
---
# 적립 포인트는 (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림

## 규칙
- 적립 포인트 = (상품 금액 − 쿠폰 할인 − 사용한 포인트)의 `POINT_RATE_PERCENT`%. 배송비에는 적립하지 않는다. 1P 미만은 버리고 반올림하지 않는다. 예: O-1042는 28270−3000−1500=23770 → 237P.
- 규칙은 `src/points/earn.js`의 `earnBase`/`pointsOf` 한 곳에서 정한다. 선물하기(`src/gift/gift-points.js`)와 환불(`src/orders/refund.js`)도 이를 쓴다. 적립에 `percentOf`(반올림)를 쓰지 않는다.
- 부분 환불 회수 포인트는 환불 전 적립 포인트 − 환불 후 적립 포인트로 계산한다(쿠폰·사용 포인트는 남은 주문에 유지).
- 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 `points.earned`를 쓴다(전체 취소 회수 포함).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
