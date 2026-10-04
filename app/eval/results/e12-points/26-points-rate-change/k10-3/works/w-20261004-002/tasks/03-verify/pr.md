# fix: 부분 환불 회수 포인트를 저장된 적립에서 남은 상품 기준 적립을 뺀 값으로 계산

## 요약
부분 환불 회수 포인트(`pointsRecovered`)가 정산팀 계산과 1~2P 어긋나던 버그를 고쳤다. O-1077의 R-0311은 131P에서 132P(403 − 271)가 된다.

## 원인
`createRefund`가 회수 포인트를 환불 상품 금액의 1% 반올림으로 따로 계산했다. 쿠폰·사용 포인트를 반영한 기준 금액의 적립(버림) 차이가 아니었다.

## 변경
- `src/points/earn.js`: `earnBase`(상품 − 쿠폰 − 사용 포인트, 배송비 제외)와 `pointsForBase`(1% 버림) 추가. `earnPoints`는 그대로.
- `src/orders/refund.js`: 회수 = (환불 전 적립) − (남은 상품 기준 적립). 첫 환불의 환불 전 적립은 저장된 `points.earned`이고, `alreadyRefunded`가 있으면 환불 전 상품 기준 적립이다. 나눠 환불한 합은 earned − 최종 남은 적립이다.
- `docs/knowledge/points/partial-refund-recovery.md`: 정산팀 규정으로 갱신.
- `refundAmount`, 영수증, `cancelOrder`는 그대로.

## 테스트
- `npm test` 24 pass, 0 fail (신규 `test/refund-points.test.js`: R-0311 132P, 나눠 환불 합, earned 불일치 주문, 쿠폰 주문).
- `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P.
- 앞 Work의 earn.js 변경과 머지 충돌 가능.
