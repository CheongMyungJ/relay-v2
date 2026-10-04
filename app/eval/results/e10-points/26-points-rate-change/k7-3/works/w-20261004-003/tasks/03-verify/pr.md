# 기본 적립률을 2%로 올리고 적립 기준을 배송비 제외·버림으로 변경

## 요약
새 주문의 적립률을 1%에서 2%로 올렸다. 적립 기준은 (결제 금액 - 배송비)이고 원 단위 미만은 버린다. 예시 주문 O-1107은 486P가 된다.

## 원인
`POINT_RATE_PERCENT`가 1이었고 `earnPoints`가 배송비 포함 금액을 반올림했다. 율만 바꾸면 O-1107이 547P가 되고, 이 상수를 쓰는 선물하기·환불 회수까지 2%가 된다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT = 2`, 옛 율은 `LEGACY_POINT_RATE_PERCENT = 1`
- `src/points/earn.js`: floor((total - shipping) × 율 / 100)
- `src/gift/gift-points.js`, `src/orders/refund.js`: 1% 유지
- README, `docs/knowledge/` 갱신
- 저장된 주문의 적립·환불·취소 값과 영수증은 바뀌지 않는다

## 테스트
- `npm test`: 21 pass, 0 fail
- 재현 테스트 'O-1107의 적립은 486P' 추가 (수정 전 273으로 실패)
- `test/order.test.js` 기존 기대값 500 → 1000 (2% 반영)
- 알려진 한계: 2% 주문의 부분 환불 회수는 아직 1%·반올림이다. 별도 후속 작업이 필요하다
