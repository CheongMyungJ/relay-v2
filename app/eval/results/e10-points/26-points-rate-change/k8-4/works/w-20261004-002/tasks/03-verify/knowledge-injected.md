## docs/knowledge/points/earn-rule.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnOn
---
# 적립 포인트는 배송비를 뺀 결제 금액의 적립률%, 소수점 버림이다

## 규칙
- 적립 기준 금액 = 상품 금액 − 쿠폰 − 사용 포인트. 배송비는 넣지 않는다 (고객센터 적립 안내 규칙).
- 적립 = 기준 금액 × 적립률(`POINT_RATE_PERCENT`)%, 소수점은 버린다. 예: O-1042는 28,270 − 3,000 − 1,500 = 23,770원 → 237P.
- 일반 주문, 선물하기 주문, 부분 환불 회수가 모두 `src/points/earn.js`의 `earnBase`/`earnOn` 한 식을 쓴다. 계산식을 복사해 쓰지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김: 배송비 포함·반올림(268P) → 배송비 제외·버림(237P) (Work w-20261004-001, 사람이 알려 줌). 이미 저장된 주문은 소급하지 않았다.

## docs/knowledge/points/partial-refund-recovery.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: fact
source: investigation
---
# 부분 환불의 포인트 회수는 환불 전후 남은 주문 적립분의 차이다

## 내용
- 부분 환불(`src/orders/refund.js` `createRefund`)은 쿠폰과 사용 포인트를 남은 주문에 그대로 둔다.
- 회수 포인트 = (환불 전 남은 주문의 적립분) − (환불 뒤 남은 주문의 적립분). 적립 규칙은 `docs/knowledge/points/earn-rule.md` 참고.
- 이렇게 해야 여러 번 환불해도 회수 합이 남은 주문의 적립분과 맞는다. 전체 취소(`cancelOrder`)는 저장된 `points.earned`를 그대로 회수한다.
- 옛 규칙(268P 등)으로 저장된 주문을 부분 환불하면 회수량이 저장된 적립과 맞지 않을 수 있다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
