## docs/knowledge/format/receipt-text.md

---
kind: rule
source: human
---
# 영수증 글자(`src/format/`)는 바뀌면 안 된다

## 규칙
- 영수증 글자는 앱과 메일이 그대로 보여 주므로 `src/format/`의 출력은 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/points/earn-points-rule.md

---
kind: rule
source: human
anchor: earnPoints
---
# 일반 주문 적립은 배송비를 뺀 결제 금액의 1%를 원 단위 버림으로 계산한다

## 규칙
- 적립 포인트 = floor((결제 금액 `amounts.total` − 배송비 `amounts.shipping`) × 1%). 예: O-1042는 23,770원 × 1% = 237.7 → 237P (`src/points/earn.js`).
- 공용 `percentOf`(반올림)는 바꾸지 않는다. 다른 계산이 함께 쓴다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: 배송비 포함 금액을 반올림한다. 사람이 Work w-20261004-001의 범위에서 뺌(2026-10-04), 다른 팀과 함께 보는 중
- src/orders/refund.js: 부분 환불의 `pointsRecovered`가 상품 금액을 `percentOf`로 반올림한다. 사람이 Work w-20261004-001의 범위에서 뺌(2026-10-04), 별도로 다룸

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/points/stored-earned-points.md

---
kind: rule
source: human
---
# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

## 규칙
- 주문의 `points.earned`는 만들 때 저장한 값 그대로 쓴다. 적립 규칙이 바뀌어도 이미 적립된 값을 다시 계산하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
