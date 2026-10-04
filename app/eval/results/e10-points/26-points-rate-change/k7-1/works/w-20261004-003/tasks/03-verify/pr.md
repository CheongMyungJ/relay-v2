# 적립률을 2%로 올리고 적립 계산을 earnOn 한 곳으로 모은다

## 요약
기본 적립률을 1%에서 2%로 올린다. O-1107의 적립 예정이 273P에서 486P가 된다. 부분 환불 회수는 정산팀 결정 전까지 기존 1%를 유지한다.

## 원인
적립률이 1%였고, 적립이 배송비 포함 결제 금액의 반올림이었다. 주문·선물·환불 회수가 각자 계산을 복제하고 있었다. 상수만 2로 바꾸면 547P가 되어 고객센터 기준 486P와 맞지 않는다.

## 변경
- `POINT_RATE_PERCENT` 1 → 2
- `earnOn(goods, coupon, pointsUsed)` 추가: (상품 − 쿠폰 − 사용 포인트)의 률% 버림. 주문(`earnPoints`)과 선물하기가 이를 쓴다
- 부분 환불 회수는 `REFUND_RECOVERY_RATE_PERCENT = 1`로 분리해 동작을 유지한다
- 저장된 주문의 `points.earned`와 `src/format/`은 바꾸지 않았다
- 지식: `docs/knowledge/refund-recovery-rate-stays-1-percent.md`

## 테스트
- `npm test`: 24개 통과
- `node src/cli.js examples/O-1107.json` → 486P, R-0311 회수 131P 유지
- 신규 `test/earn.test.js`, 기존 order·gift 테스트의 기댓값을 2% 기준으로 갱신
- 알려진 점: 회수가 적립률 상수와 분리되어 있다(정산팀 결정 대기)
