# 적립률 2%로 인상, 적립 기준을 earnFromAmounts로 통일 (환불 회수는 1% 유지)

## 요약
- 기본 적립률을 1%에서 2%로 올린다. 이번 배포부터 새로 적립되는 포인트에 적용한다. O-1107은 486P다.
- 환불 시 포인트 회수는 지금 동작 그대로 1%다. 새 비율 적용 여부는 정산팀과 따로 정한다.

## 원인
- 비율이 `POINT_RATE_PERCENT = 1`이었고, 적립 계산이 배송비 포함 결제 금액에 반올림을 썼다. 비율 상수만 2%로 바꾸면 O-1107이 547P가 되고 환불 회수도 2%가 된다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT = 2`, 환불 회수율 `REFUND_RECOVER_RATE_PERCENT = 1`을 분리했다.
- `src/points/earn.js`: `earnFromAmounts` 추가. (상품 − 쿠폰 − 사용 포인트) × 비율, 배송비 제외, 1P 미만 버림. 일반 주문과 선물하기(`gift-points.js`)가 같은 함수를 쓴다.
- `src/orders/refund.js`: 회수율만 `REFUND_RECOVER_RATE_PERCENT`로 바꿨고 계산식은 그대로다.
- 이미 저장된 `points.earned`는 다시 계산하지 않는다. `src/format/`은 바뀌지 않았다.
- `docs/knowledge/points/`의 팀 지식을 갱신했다.

## 테스트
- `npm test`: 24개 통과.
- 새 `test/earn-rate.test.js`: O-1107 486P, 선물하기 486P, 1P 미만 버림, 환불 회수 1% 유지.
- 기존 테스트 기대값 2건을 2%에 맞췄다 (`order.test.js` 500 → 1000, `gift.test.js` 300 → 600). 입력은 같다.
