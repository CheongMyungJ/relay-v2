# 적립률 2%로 인상, 적립 기준(배송비 제외)·버림 적용, 환불 회수 비율 1% 분리

## 요약
기본 적립률을 1%에서 2%로 올린다. 적립 기준 금액을 상품 − 쿠폰 − 사용 포인트(배송비 제외)로, 계산을 원 단위 버림으로 규정에 맞춘다. 환불 회수는 지금과 같은 1%로 유지한다.

## 원인
`earnPoints`와 `giftPoints`가 배송비 포함 결제액을 반올림해 계산해 규정과 달랐다. `refund.js`가 적립률 상수를 직접 써서 상수를 올리면 회수도 따라 바뀌는 구조였다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT` 2, 회수용 `POINT_RECOVER_RATE_PERCENT` 1 추가
- `src/money.js`: 버림 `floorPercentOf` 추가
- `src/points/earn.js`: 기준 금액 변경과 버림 적용
- `src/gift/gift-points.js`: `earnPoints` 호출
- `src/orders/refund.js`: 회수 비율 상수만 교체
- `docs/knowledge/points/earn-base-and-rounding.md`: 적립률과 회수 비율 분리를 기록
- 저장된 주문과 영수증(`src/format/`)은 바꾸지 않았다

## 테스트
- `npm test`: 22건 통과
- O-1107 `createOrder`로 확인: `points.earned` 486 (수정 전 273)
- 기존 테스트 2건의 기대값은 2% 기준으로 올렸고(500→1000, 300→600), O-1107과 선물하기 테스트를 추가했다
