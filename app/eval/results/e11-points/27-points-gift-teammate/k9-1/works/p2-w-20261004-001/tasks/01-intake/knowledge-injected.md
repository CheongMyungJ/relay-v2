## docs/knowledge/points/earn-basis.md

---
kind: rule
source: investigation
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 금액의 1%를 원 단위로 버린다

## 규칙
- 기준 금액 = 상품 − 쿠폰 할인 − 사용 포인트 (배송비 제외). 적립 = 기준 금액 × `POINT_RATE_PERCENT`% 를 버림. 예: O-1042는 23,770원 → 237P.
- 이미 적립된 주문(`order.points.earned`)은 재계산하지 않고 저장된 값을 쓴다.
- 고객센터 계산식 문서는 레포에 없다. 이 기준은 O-1042의 237P에서 역산한 것이다(Work w-20261004-001).
- `src/money.js`의 `percentOf`(반올림)는 환불·선물하기가 함께 쓰므로 적립 계산 때문에 바꾸지 않는다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: 결제 금액 1% 반올림. 사람이 Work w-20261004-001의 범위에서 뺌(2026-10-04)
- src/orders/refund.js:34: 환불 회수 포인트가 상품 금액 1% 반올림. 리뷰에서 어긋남으로 확인했고 이번 범위에서 고치지 않음(2026-10-04)

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
