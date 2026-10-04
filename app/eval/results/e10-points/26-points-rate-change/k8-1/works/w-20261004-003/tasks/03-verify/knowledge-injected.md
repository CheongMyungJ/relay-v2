## docs/knowledge/orders/already-refunded-format.md (Work w-20261004-002에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# createRefund의 alreadyRefunded는 sku마다 누적 수량 한 줄이어야 한다

## 내용
- `createRefund(order, input)`의 `input.alreadyRefunded`는 `{sku, qty}` 목록이고 sku마다 한 줄, qty는 지금까지 환불한 누적 수량이다 (`src/orders/refund.js`).
- 같은 sku를 여러 줄로 넘기면 `Map`으로 만드는 과정에서 마지막 줄만 남아 이미 환불한 수량이 줄어든다. 남은 상품 금액과 회수 포인트가 틀어지는데 오류는 나지 않는다.
- 다회 환불을 시험하는 테스트를 쓸 때(예: `test/refund.test.js`의 다회 환불 테스트) 매 단계의 환불 항목을 그대로 쌓지 말고 sku별로 수량을 더해 넘긴다. 같은 sku를 두 번 환불한 O-1077에서 합계가 344P여야 하는데 345P가 나온 적이 있다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-002)

## docs/knowledge/points/earn-rule.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnPoints
---
# 적립 규정: 상품−쿠폰−사용 포인트의 1%, 배송비 제외, 1P 미만 버림

## 규칙
- 적립 기준 금액은 상품 금액에서 쿠폰 할인과 사용한 포인트를 뺀 금액이다. 배송비에는 적립하지 않는다.
- 기준 금액의 1%에서 1P 미만은 버린다(반올림하지 않는다). 예: 상품 28,270 − 쿠폰 3,000 − 포인트 1,500 = 23,770원 → 237P.
- 적립 계산은 `src/points/earn.js`의 `earnBase`/`earnOn`/`earnPoints` 한 곳에서 한다. 일반 주문, 선물하기, 환불 회수가 모두 이것을 쓴다.
- 이미 저장된 주문의 `points.earned`는 규정이 바뀌어도 다시 계산하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김. 옛 방식은 배송비 포함 결제 금액의 1% 반올림이었다 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/points/partial-refund-recovery.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: createRefund
---
# 부분 환불 포인트 회수 합계는 저장된 적립액을 넘지 않고 적립 규정과 맞는다

## 규칙
- 한 주문에서 여러 번 부분 환불해도 회수 포인트 합계는 그 주문의 저장된 적립액(`points.earned`)을 넘지 않는다.
- 회수 방식은 적립 규정과 맞는다. 적립 규정은 docs/knowledge/points/earn-rule.md 참고.
- 구현: 회수 = (환불 전 남은 주문의 적립액) − (환불 후 남은 주문의 적립액). 쿠폰·사용 포인트는 남은 주문에 그대로 두고, 남은 적립액은 저장된 적립액 이하로 제한한다 (`src/orders/refund.js`).

## 바뀐 이력
- 2026-10-04 처음 남김. 옛 방식은 환불 상품 금액의 1%를 건마다 반올림해 합이 저장된 적립액보다 1P 많아질 수 있었다 (Work w-20261004-001, 사람이 알려 줌)
