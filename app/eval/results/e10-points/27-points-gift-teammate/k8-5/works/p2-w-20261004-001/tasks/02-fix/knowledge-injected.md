## docs/knowledge/points/earn-points-formula.md

---
kind: rule
source: investigation
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 결제 금액의 1%를 1P 미만 버림한 값이다

## 규칙
- 적립 포인트 = floor((결제 금액 `amounts.total` − 배송비 `amounts.shipping`) × `POINT_RATE_PERCENT` / 100). 고객센터 기준 O-1042는 237P (23770 × 1% = 237.7 → 237).
- 정책 문서는 없다. 237P를 고객센터 값에서 거꾸로 맞춘 식이므로, 다른 주문의 정답으로는 검증되지 않았다.
- 공유 도우미 `percentOf`(`src/money.js`)는 반올림이라 적립에 쓰지 않는다. 선물하기와 공유하므로 바꾸지 않는다.

## 아직 규칙을 따르지 않는 곳
- src/orders/refund.js: 부분 환불의 `pointsRecovered`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`(상품 금액 기준, 반올림)라 적립 식과 다르다. 적립보다 1P 더 회수할 수 있다. 환불 정책 확인 후 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/points/gift-points-hands-off.md

---
kind: rule
source: human
anchor: giftPoints
---
# 선물하기 적립(`giftPoints`)은 다른 팀과 협의 전에는 포인트 관련 일에서도 바꾸지 않는다

## 규칙
- `src/gift/gift-points.js`는 다른 팀과 함께 보고 있어 포인트 적립 수정 일에서도 손대지 않는다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: `earnPoints`의 옛 식(배송비 포함, 반올림)을 그대로 써서 같은 과다 적립이 있을 수 있다. 협의 후 `docs/knowledge/points/earn-points-formula.md`의 식에 맞출지 정한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/points/stored-points-not-recalculated.md

---
kind: rule
source: human
---
# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

## 규칙
- 주문의 `points.earned`는 주문을 만들 때 한 번만 계산해 저장한다. 계산식이 바뀌어도 이미 적립된 주문은 다시 계산하지 않는다.
- 영수증, 환불(전체 취소), 포인트 내역은 저장된 값을 그대로 쓴다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
