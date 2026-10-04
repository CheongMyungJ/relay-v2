## docs/knowledge/points/earn-rule.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnBase
---
# 포인트 적립은 (상품 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림

## 규칙
- 적립 기준 금액은 상품 금액에서 쿠폰 할인과 사용한 포인트를 뺀 값이다. 배송비는 넣지 않는다. 계산은 `earnBase`(src/points/earn.js)가 한다.
- 적립 포인트는 기준 금액 × 적립률(`POINT_RATE_PERCENT`, 1%)에서 1P 미만을 버린다(반올림 아님). 예: O-1042는 (28,270 − 3,000 − 1,500) × 1% = 237.7 → 237P.
- 일반 주문(`earnPoints`), 선물하기(`giftPoints`), 부분 환불 회수가 모두 같은 기준이다. 부분 환불 회수는 환불 상품 금액의 1% 버림이다. 전체 취소는 저장된 `points.earned`를 그대로 회수한다.
- 이미 저장된 주문의 `points.earned`는 다시 계산하지 않고 저장된 값을 쓴다. 영수증 글자(`src/format/`)는 바뀌면 안 된다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
