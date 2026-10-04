# 적립률 2%로 올리고 적립 규정을 earn.js 한 곳으로 모음

## 요약
기본 적립률을 1%에서 2%로 올렸다. 새 주문의 적립은 (상품 − 쿠폰 − 사용 포인트)의 2%, 배송비 제외, 1P 미만 버림이다. O-1107은 486P다.

## 원인
적립이 결제 금액(배송비 포함)에 `POINT_RATE_PERCENT`를 곱해 반올림했고, 선물하기와 환불 회수가 같은 상수를 따로 썼다. 값만 2로 바꾸면 O-1107이 547P가 되고 환불 회수도 2%로 바뀐다.

## 변경
- `src/config.js`: `EARN_RATE_PERCENT=2` 추가, 환불 회수율은 `REFUND_RECOVER_PERCENT=1`로 분리(현행 유지)
- `src/points/earn.js`: `earnBase`/`earnOn`/`earnPoints`로 규정 구현. `src/gift/gift-points.js`가 이를 사용
- `src/orders/refund.js`: 회수율 상수만 교체, 계산 결과 불변
- `README.md`: 적립률 안내 갱신
- `docs/knowledge/points/`: `earn-rule.md` 2%로 갱신, `refund-recover-rate.md` 추가
- 저장된 주문의 `points.earned`와 `src/format/`은 건드리지 않음

## 테스트
- `npm test`: 25개 통과
- 새 `test/earn.test.js`: O-1107 486P, 배송비 제외, 선물하기, 환불 회수 불변
- 기존 테스트 기대값 변경 2건: order 500→1000, gift 300→600 (2% 반영)
- 환불 회수를 새 비율로 계산할지는 정산팀과 따로 정함
