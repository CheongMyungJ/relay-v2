# fix: 부분 환불 포인트 회수를 저장된 적립과 남은 주문 적립분의 차이로 계산

## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P 어긋나던 것을 고쳤다. O-1077/R-0311은 131P에서 132P가 된다.

## 원인
`createRefund`가 환불 상품 금액에 적립률을 곱해 반올림했다. 쿠폰과 사용 포인트는 남은 주문에 그대로 남는데 이를 반영하지 않아, 남은 주문 적립분의 감소량과 달랐다.

## 변경
- `src/orders/refund.js`: 회수 = 환불 전 적립분 − 환불 뒤 남은 주문 적립분(상품 − 쿠폰 − 사용 포인트, 배송비 제외, 버림). 첫 환불의 환불 전 적립분은 `order.points.earned`, 나눠 환불은 남은 상품으로 재계산.
- `refundAmount`, `cancelOrder`, `src/format/`은 그대로.
- `docs/knowledge/points/partial-refund-recovery.md` 정리.

## 테스트
- `npm test` 23개 통과.
- `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P.
- 추가 테스트: R-0311 132P, 나눠 환불 합 132P, 저장 적립이 다를 때 첫 환불 회수.
