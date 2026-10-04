## docs/knowledge/points/earn-rule.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnBase
---
# 포인트 적립은 배송비를 뺀 기준액의 적립률을 원 단위로 버림한다

## 규칙
- 적립 기준액은 배송비를 뺀 금액이다: 상품금액 − 쿠폰 − 사용 포인트 (`earnBase`).
- 적립 포인트는 기준액의 `POINT_RATE_PERCENT`%를 원 단위로 버림한 값이다 (`earnOnBase`, `floorPercentOf`). 예: O-1042는 23,770원 → 237P.
- 일반 주문(`earnPoints`), 선물하기(`giftPoints`), 부분 환불 회수(환불 전 기준액 적립 − 환불 후 기준액 적립)가 모두 같은 함수를 쓴다.
- 전체 취소와 영수증은 주문에 저장된 `points.earned`를 쓴다. 이미 적립된 값은 다시 계산하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김. 이전에는 배송비를 포함한 결제금액을 반올림했다 (Work w-20261004-001, 사람이 알려 줌)
