# fix: 부분 환불 회수 포인트를 원래 적립 − 남은 상품 재계산 적립(버림)으로 계산

## 요약
부분 환불의 회수 포인트가 정산팀 계산과 1~2P씩 어긋나던 문제를 고쳤다. O-1077/R-0311은 131P에서 132P가 된다.

## 원인
`createRefund`가 환불 상품 금액의 1%를 반올림해 회수했다. 적립 규정(쿠폰·사용 포인트를 뺀 금액의 1%, 버림)과 달라 쿠폰·사용 포인트가 있는 주문에서 어긋났다.

## 변경
- `src/orders/refund.js`: 회수 포인트 = 저장된 `order.points.earned` − `remainingEarn`(남은 상품 − 쿠폰 − 사용 포인트의 1%, 버림). 쿠폰·사용 포인트는 남은 주문에 그대로 둔다.
- `test/refund.test.js`: O-1077/R-0311 테스트 추가.
- `docs/knowledge/points/earn-rule.md`: 부분 환불 회수 규정 기록.
- `earn.js`, `cancelOrder`, `refundAmount`, `src/format/`은 변경 없음.

## 테스트
- `npm test`: 21 통과, 0 실패
- 재현 명령: `pointsRecovered` 132
- 알려진 한계: 같은 주문의 두 번째 이후 부분 환불에서 앞선 회수분을 차감하지 않는다(규정 미정).
