# 적립률 2%로 변경, 적립 기준을 배송비 제외 상품 금액 버림으로 맞춤

## 요약
기본 적립률을 1%에서 2%로 올리고, 적립 기준을 O-1107 = 486P(고객센터 계산)에 맞춘다. 일반·선물하기 주문 모두 적용한다. 저장된 주문의 적립, 영수증 글자, 환불 회수는 그대로다.

## 원인
비율만 2%로 바꾸면 O-1107이 547P가 된다. 적립 기준이 결제 금액(배송비 포함, 반올림)이었는데 기대값은 상품 − 쿠폰 − 사용 포인트(배송비 제외) 24,330원의 2%를 버림한 값이다. 또 `createRefund`가 `POINT_RATE_PERCENT`를 직접 써서 상수만 바꾸면 환불 회수도 달라진다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT` 2, 환불 회수용 `REFUND_RECOVERY_RATE_PERCENT` 1 추가
- `src/points/earn.js`: `pointsFor` 추가(배송비 제외, 버림). 일반·선물(`gift-points.js`)이 공유
- `src/orders/refund.js`: 회수 비율을 분리 상수로 바꿔 기존 계산 유지(131P)
- 테스트: `earn-rate.test.js` 추가, 기존 기대값 2건 갱신(500→1000, 300→600)
- `docs/knowledge/points/earn-basis.md` 갱신

## 테스트
- `npm test`: 24 통과
- `node src/cli.js examples/O-1107.json` → 486P, R-0311 환불 → -131P
- 환불에 새 비율을 쓸지는 정산팀과 따로 정한다. 앞 Work와 머지할 때 `earn.js`, `refund.js` 충돌에 주의
