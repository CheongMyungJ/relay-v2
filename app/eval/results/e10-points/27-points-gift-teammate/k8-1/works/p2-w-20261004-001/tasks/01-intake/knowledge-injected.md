## docs/knowledge/points/earn-points-basis.md

---
kind: rule
source: investigation
anchor: earnPoints
---
# 일반 주문 적립은 배송비를 뺀 금액의 1%를 1P 미만 버림으로 계산한다

## 규칙
- 기준 금액은 상품 - 쿠폰 - 사용 포인트(= `amounts.total - amounts.shipping`)이고, 여기에 `POINT_RATE_PERCENT`%를 곱해 1P 미만은 버린다 (`src/points/earn.js`). 예: O-1042는 23,770원 → 237P.
- 이미 저장된 `points.earned`는 다시 계산하지 않고 그대로 쓴다.
- 이 기준은 적립 안내 문서가 아니라 O-1042 한 건(237P)에서 역산해 정했다. 반올림이면 238P, 배송비 포함이면 268P라 맞지 않는다.

## 아직 규칙을 따르지 않는 곳
- `src/orders/refund.js`: 부분 환불의 `pointsRecovered`는 `percentOf(상품 환불액)` 반올림이라 위 기준과 다르다. 고칠지는 환불 기준 확인 후 정한다.
- `src/gift/gift-points.js`: 선물하기 적립은 배송비 포함·반올림이다. 다른 팀과 함께 볼 일이다 (`points/gift-points-ownership.md` 참고).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/points/gift-points-ownership.md

---
kind: rule
source: human
anchor: giftPoints
---
# 선물하기 적립(`giftPoints`)은 다른 팀과 같이 보고 있어 이 팀이 단독으로 고치지 않는다

## 규칙
- `src/gift/gift-points.js`는 다른 팀과 함께 보는 파일이다. 이 팀의 일에서 단독으로 수정하지 않는다.
- 일반 주문 적립 기준과 맞추는 일은 다른 팀과 함께 정한다 (일반 주문 기준은 `points/earn-points-basis.md` 참고).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
