## docs/knowledge/earn-points-base-and-rounding.md

# 적립 포인트는 배송비를 뺀 금액의 비율을 원 단위로 버려 계산한다

- 종류: 규칙
- 적용: 적립 포인트 계산 전반 (일반 주문 `src/points/earn.js`, 선물하기·부분 환불 등 적립/회수를 계산하는 곳)
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

고객센터 적립 안내 기준: 기준 금액 = 상품 금액 − 쿠폰 할인 − 사용 포인트 (배송비 제외). 적립 = 기준 금액 × `POINT_RATE_PERCENT`% 를 원 단위로 버림.
예: O-1042는 기준 23,770원 × 1% = 237.7 → 237P (배송비 포함 반올림이면 268P로 틀림).
이번 Work는 일반 주문만 고쳤다. 선물하기(`src/gift/gift-points.js`)와 부분 환불 회수(`src/orders/refund.js`)는 반올림 `percentOf`를 따로 써서 같은 차이가 남아 있을 수 있다(관련 위치).

## docs/knowledge/earn-points-rounding-mismatch-in-copies.md

# 적립 계산을 복제한 곳은 적립 기준과 어긋나기 쉽다

- 종류: 실패 유형
- 적용: `src/gift/gift-points.js`, `src/orders/refund.js`(부분 환불 pointsRecovered)
- 출처: 조사로 알아냄, relay Work w-20261004-001, 2026-10-04

적립 계산을 `money.js`의 `percentOf`(반올림)로 따로 복제한 곳이 있다. 적립 기준(버림)과 달라 예: 1,990원 → 적립 19P인데 회수는 20P가 될 수 있다.
적립 규칙을 바꿀 때는 이 복제 위치도 함께 확인한다. `percentOf` 자체는 다른 곳이 쓰므로 바꾸지 않는다.
