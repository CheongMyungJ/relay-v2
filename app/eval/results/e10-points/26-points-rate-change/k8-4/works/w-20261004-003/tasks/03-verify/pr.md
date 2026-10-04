# 적립률 2%로 변경, 적립을 배송비 제외·버림 한 식으로 통일

## 요약
기본 적립률을 1%에서 2%로 올리고, 적립을 규정(상품 − 쿠폰 − 사용 포인트, 배송비 제외, 1P 미만 버림)대로 계산하게 했다. O-1107은 486P, G-0213은 437P가 된다.

## 원인
`earnPoints`와 `giftPoints`가 배송비 포함 금액에 반올림을 쓰고 식이 두 곳에 복사돼 있었다. `POINT_RATE_PERCENT`는 부분 환불 회수에도 쓰여, 상수만 올리면 환불 회수도 2%가 된다.

## 변경
- `src/points/earn.js`: `earnBase`/`earnOn` 추가, `earnPoints`가 사용
- `src/gift/gift-points.js`: `earnPoints`에 위임
- `src/config.js`: `POINT_RATE_PERCENT` 2, 환불 회수용 `REFUND_RECOVERY_RATE_PERCENT` 1 추가
- `src/orders/refund.js`: 새 상수를 쓰도록 한 줄 변경 (환불 회수 1% 유지, 동작 불변)
- 저장된 주문의 `points.earned`와 `src/format/`은 바뀌지 않는다.
- `docs/knowledge/points/`의 적립 규칙과 환불 회수 항목 갱신

## 테스트
- `npm test`: 22개 통과
- 새 `test/earn.test.js`: O-1107=486, G-0213=437
- 기존 테스트 기대값만 2% 반영(order 500→1000, gift 300→600)
- 환불 회수율은 정산팀 결정 전까지 1%라, 새 주문 부분 환불은 적립분보다 적게 회수된다.
