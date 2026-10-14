---
kind: rule
source: human
anchor: MAX_DISCOUNT_RATE
---
# 할인 상한은 주문 금액의 50%

## 규칙
- 어떤 쿠폰이든 할인 금액은 주문 금액(배송비 제외)의 50%를 넘지 않는다. 상한은 `MAX_DISCOUNT_RATE` 하나로 둔다.

## 바뀐 이력
- 2026-06-03 처음 남김 (Work w-20260603-002)
