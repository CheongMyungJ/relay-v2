# 적립률을 2%로 올리고 적립 대상에서 배송비를 제외한다

## 요약
2026-10-04부터 일반 주문·선물하기 적립률을 1%에서 2%로 올린다. 적립 대상은 (상품 금액 − 쿠폰 − 사용 포인트), 1P 미만 버림. 환불 회수는 지금 동작 그대로 둔다.

## 원인
적립이 배송비 포함 결제 금액(`amounts.total`)에 반올림으로 계산됐다. 같은 상수를 환불도 써서 상수만 바꾸면 O-1107이 547P가 되고 환불 회수도 바뀐다.

## 변경
- `src/config.js`: `EARN_RATE_PERCENT=2`, `REFUND_RATE_PERCENT=1`로 분리
- `src/points/earn.js`: floor((상품−쿠폰−사용 포인트)×2%)
- `src/gift/gift-points.js`: `earnPoints` 재사용
- `src/orders/refund.js`: `REFUND_RATE_PERCENT` 사용(계산 그대로)
- README 상수 이름, `docs/knowledge/points/earn-rule.md` 갱신
- `src/format/`과 저장된 적립값은 그대로

## 테스트
- `npm test` 23개 통과
- O-1107 486P, G-0213 437P, R-0311 회수 131P(변경 전과 같음)
- 기존 테스트 기대값 2건 변경(500→1000, 300→600): 2% 적용 결과
