# 기본 적립률을 2%로 올리고 적립 계산을 규정대로 고침

## 요약
새 주문의 적립률을 1%에서 2%로 올린다. 환불 회수와 선물하기 적립은 지금 결과(1%)를 유지한다.

## 원인
상수가 1이었고, `earnPoints`가 규정과 달리 배송비가 든 결제 금액에 반올림을 썼다. 환불 회수·선물하기도 같은 상수를 써서 상수만 바꾸면 둘도 2%가 된다. O-1107이 486P가 아닌 273P로 나왔다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT = 2`, 환불용 `REFUND_RECOVER_RATE_PERCENT = 1`, 선물하기용 `GIFT_POINT_RATE_PERCENT = 1` 분리
- `src/points/earn.js`: (상품 - 쿠폰 - 사용 포인트) × 적립률을 1P 미만 내림
- `src/orders/refund.js`, `src/gift/gift-points.js`: 분리한 상수 사용 (동작 동일)
- `docs/knowledge/points/earn-rule.md`: 2% 적립률과 미정 사항 기록
- `test/order.test.js`: O-1107 테스트 추가, 기존 적립 기대값 500→1000 (비율 변경 결과)

## 테스트
- `npm test`: 21 pass, 0 fail
- O-1107 `createOrder` 결과 `points.earned` = 486
- 영수증(`src/format/`)과 저장된 적립값은 변경 없음
