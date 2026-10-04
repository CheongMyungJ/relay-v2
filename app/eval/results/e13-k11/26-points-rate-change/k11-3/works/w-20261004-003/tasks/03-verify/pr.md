# 적립률을 2%로 올리고 적립 기준을 배송비 제외 순 금액 버림으로 맞춘다

## 요약
기본 적립률을 1%에서 2%로 올리고, 새 주문 적립이 배송비 제외 순 금액을 버림해 계산되게 했다. O-1107은 486P다.

## 원인
적립률이 1%였고, 적립 계산이 배송비가 든 `amounts.total`에 반올림을 써서 팀 규칙과 달랐다. 값만 2로 올리면 547P라 기대값 486과 어긋난다. 선물하기도 같은 식을 복제했고, 환불 회수가 `POINT_RATE_PERCENT`를 공유해 값을 올리면 함께 바뀌었다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT = 2`, 환불 회수용 `REFUND_RECOVER_RATE_PERCENT = 1` 추가
- `src/points/earn.js`: (상품 − 쿠폰 − 사용 포인트) × 비율, 버림
- `src/gift/gift-points.js`: `earnPoints`에 위임
- `src/orders/refund.js`: 회수 비율을 새 상수로 분리해 결과 유지(정산팀과 따로 정함)
- `docs/knowledge/points/earn-basis.md`: 적립률 2%와 환불 회수 미정 사항 기록
- 저장된 `points.earned`, ledger, `src/format/`은 건드리지 않았다.

## 테스트
- `npm test`: 23 통과
- 새 `test/earn.test.js`(적립률, O-1107 486, 선물 486)
- 기존 테스트 기대값 변경: order 500→1000, gift 300→600 (2% 반영)
