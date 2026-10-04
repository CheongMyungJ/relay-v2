# fix: 부분 환불 회수 포인트를 저장된 적립 − 남은 상품 재계산 적립(버림)으로 계산

## 요약
부분 환불의 회수 포인트를 정산팀 규칙에 맞췄다. O-1077/R-0311은 131P에서 132P가 된다. 환불 금액 13,130원은 그대로다.

## 원인
`createRefund`가 환불 상품 금액의 1%를 반올림(`percentOf`)해 회수했다. 쿠폰·사용 포인트와 버림을 반영한 남은 상품 재계산 적립과 어긋났다.

## 변경
- `src/orders/refund.js`: 회수 = `order.points.earned` − floor((남은 상품 − 쿠폰 − 사용 포인트) × 1%). `percentOf`는 바꾸지 않음.
- `test/refund.test.js`: O-1077/R-0311 케이스 추가.
- `docs/knowledge/partial-refund-points-recovery.md`: 규칙 기록.
- 알려진 한계: 두 번째 이후 부분 환불은 누적 회수값이라 이전 회수분과 중복될 수 있음.

## 테스트
- `npm test`: 21개 통과, 0 실패
- O-1077/R-0311 직접 실행: pointsRecovered 132, refundAmount 13130
