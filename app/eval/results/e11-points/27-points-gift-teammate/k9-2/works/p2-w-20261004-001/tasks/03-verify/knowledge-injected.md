## docs/knowledge/points/earn-rule.md

---
kind: rule
source: investigation
anchor: earnPoints
---
# 일반 주문 적립 포인트는 배송비를 뺀 결제 금액의 1%를 원 단위 내림한다

## 규칙
- 적립 포인트 = `floor((total - shipping) × 1%)`. 예: O-1042은 total 26,770 − 배송비 3,000 = 23,770 → 237P (고객센터 기준).
- 이미 저장된 주문의 `points.earned`는 다시 계산하지 않고 저장된 값을 쓴다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: 총액(`amounts.total`)을 1% 반올림한다. 다른 팀과 같이 보는 중이라 사람이 Work w-20261004-001의 범위에서 뺌(2026-10-04)
- src/orders/refund.js:34: 부분 환불 회수 포인트를 상품 금액 1% 반올림으로 계산한다. 적립 규칙과 다를 수 있으나 확인하지 않았고 이 Work에서 건드리지 않음

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001). 배송비 제외·내림은 O-1042 한 건의 고객센터 값(237P)에서 추론한 기준이다
