# 적립률 2%로 변경, 적립 기준에서 배송비 제외하고 내림 적용

## 요약
기본 적립률을 1%에서 2%로 올린다. 적립 기준은 상품 − 쿠폰 − 사용 포인트(배송비 제외)이고 1P 미만은 버린다. 일반 주문과 선물하기 주문이 같은 기준을 쓴다. 환불 회수 계산은 그대로 둔다.

## 원인
`POINT_RATE_PERCENT`가 1이었고, `earnPoints`/`giftPoints`가 배송비가 든 결제 금액에 반올림을 썼다. `createRefund`도 같은 상수를 import해서 값만 2로 바꾸면 환불 회수도 2%로 바뀐다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT = 2`, 환불용 `POINT_RECOVERY_RATE_PERCENT = 1` 추가
- `src/money.js`: 내림 `floorPercentOf` 추가
- `src/points/earn.js`: `earnBase`(배송비 제외)의 2% 내림
- `src/gift/gift-points.js`: `earnPoints`에 위임
- `src/orders/refund.js`: 계산은 그대로, 비율 상수만 `POINT_RECOVERY_RATE_PERCENT` 사용
- 테스트: `order.test.js` 500→1000, `gift.test.js` 300→600 (2% 반영), `earn-rate.test.js` 추가
- `docs/knowledge/refund-recovery-rate-separate-from-earn-rate.md` 추가
- 이미 저장된 `points.earned`와 `src/format/`은 바꾸지 않음

## 테스트
- `npm test`: 24 통과, 0 실패
- O-1107 적립 486P 확인(수정 전 273P)
- 환불 회수 불변 테스트 통과
- 주의: 새 비율을 환불 회수에 쓸지는 정산팀과 따로 정한다
