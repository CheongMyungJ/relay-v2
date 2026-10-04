# 일반 주문 적립률을 2%로 올리고 적립 기준을 상품−쿠폰−사용 포인트로 맞춘다

## 요약
2026-10-04 배포부터 새 주문의 적립률을 1%에서 2%로 올린다. 환불 회수와 선물하기는 기존 1%를 유지한다.

## 원인
`earnPoints`가 배송비를 포함한 결제 금액에 반올림을 써서 팀 규칙(배송비 제외, 버림)과 달랐고, 적립률 상수를 환불 회수·선물하기가 함께 써서 상수만 올리면 환불 회수가 바뀌었다.

## 변경
- `src/points/earn.js`: (상품 − 쿠폰 − 사용 포인트) × 비율, 배송비 제외, `Math.floor`
- `src/config.js`: `POINT_RATE_PERCENT=2`, `REFUND_RECOVER_RATE_PERCENT=1`, `GIFT_POINT_RATE_PERCENT=1`로 분리
- `src/orders/refund.js`, `src/gift/gift-points.js`: 분리한 상수 사용(동작 불변)
- `docs/knowledge/points/earn-rule.md`: 2% 정책과 상수 분리 기록
- 저장된 `points.earned`와 영수증 출력은 건드리지 않음

## 테스트
- `npm test`: 22개 통과
- O-1107 적립 273 → 486P, O-1077/R-0311 회수 131P 유지(기준 커밋과 비교)
- 기존 테스트 1건 기대값 변경: order.test.js 500 → 1000(2% 반영)
