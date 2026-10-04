## docs/knowledge/points/earn-base.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: earnFromAmounts
---
# 포인트 적립 기준은 (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 1P 미만 버림

## 규칙
- 적립 포인트 = (상품 금액 − 쿠폰 할인 − 사용한 포인트)의 `POINT_RATE_PERCENT`%. 배송비는 제외하고 1P 미만은 버린다(반올림 아님). 예: 주문 O-1042는 237P.
- 일반 주문 적립, 선물하기 적립, 환불 시 포인트 회수 모두 같은 기준이다.
- 기준은 `src/points/earn.js`의 `earnFromAmounts`에 있다. 새 적립·회수 경로는 이 함수를 쓴다.

## 바뀐 이력
- 2026-10-04 처음 남김. 이전에는 배송비 포함 결제 금액의 1%를 반올림했다 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/points/stored-earned-not-recalculated.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 이미 적립·저장된 포인트(points.earned)는 다시 계산하지 않는다

## 규칙
- 적립 기준이 바뀌어도 저장된 주문의 `points.earned`는 재계산하거나 고치지 않는다.
- 전체 취소(`cancelOrder`)는 저장된 `points.earned`를 그대로 회수한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
