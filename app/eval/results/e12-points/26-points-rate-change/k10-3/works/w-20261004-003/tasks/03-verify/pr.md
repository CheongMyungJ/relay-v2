# 적립률 2%로 상향, 적립 기준을 배송비 제외·버림으로 정리

## 요약
이번 배포부터 기본 적립률(`POINT_RATE_PERCENT`)을 1%에서 2%로 올린다. 율만 올리면 O-1107이 486P가 아니라 547P가 되어, 적립 기준도 팀 규칙(배송비 제외, 원 단위 버림)에 맞췄다. 환불 회수는 정산팀과 따로 정하기로 해 옛 1%를 유지한다.

## 원인
적립이 `order.amounts.total`(배송비 포함)을 기준으로 `percentOf`(반올림)를 써서, 율만 2%로 바꾸면 기준 24,330원의 486P(고객센터 계산)가 아니라 547P가 나온다. 지금은 273P다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT` 1 → 2. 환불 회수용 `REFUND_RECOVERY_RATE_PERCENT = 1`을 새로 둠
- `src/points/earn.js`: `earnBase`(상품 − 쿠폰 − 사용 포인트), `pointsForBase`(버림), `earnPoints`
- `src/gift/gift-points.js`: `earnPoints`를 그대로 사용
- `src/orders/refund.js`: 율 상수 이름만 `REFUND_RECOVERY_RATE_PERCENT`로 바꿔 회수 계산은 그대로
- `README.md`: 적립 기준 안내
- 이미 저장된 `points.earned`는 다시 계산하지 않고, `src/format/`은 바꾸지 않았다
- 기존 테스트 기대값: `test/order.test.js` 500 → 1000, `test/gift.test.js` 300 → 600 (율 변경에 따른 값)
- 팀 지식: `docs/knowledge/points/earn-base.md`, `partial-refund-recovery.md`

## 테스트
- `npm test`: 22개 통과
- 재현 테스트 `test/earn-rate.test.js`: 기준 커밋에서는 486 기대·273 실제로 실패, 지금은 통과
- 주의: 환불 회수는 1% 반올림 그대로라 2%로 적립된 주문을 부분 환불하면 적립보다 적게 회수된다. 정산팀과 따로 정한다
