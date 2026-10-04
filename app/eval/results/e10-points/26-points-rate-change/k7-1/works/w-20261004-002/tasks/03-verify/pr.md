# fix: 부분 환불 포인트 회수를 정산 기준(저장 적립 − 남은 상품 적립)으로 계산

## 요약
부분 환불(R-0311, O-1077)이 131P를 회수하던 것을 정산팀 기준 132P로 맞췄다. 회수는 적립을 넘지 않는다.

## 원인
`createRefund`가 환불 상품 금액에 적립률을 바로 곱해 반올림했다(13,130 × 1% = 131). 적립은 (상품 − 쿠폰 − 사용 포인트)를 버림한 값이라 기준이 달랐다.

## 변경
- `src/points/earn.js`: 적립 기준 금액을 버림하는 `earnOn(base)` 추가.
- `src/orders/refund.js`: 회수 = 저장된 적립 − 남은 상품(− 쿠폰 − 사용 포인트)의 적립. 이전 부분 환불이 있으면 그 몫을 뺀다. 0 미만, 적립 초과는 막는다.
- 환불 금액, 영수증, 저장된 `points.earned`, 전체 취소는 바꾸지 않았다.
- `docs/knowledge/refund-recovery-follows-earn-rule.md`: 정확한 식을 추가했다.

## 테스트
- `npm test` 24 pass, 0 fail (테스트 4개 추가: R-0311 132P, 나눠 환불, 적립 초과 방지, 저장 적립이 재계산과 다른 주문).
- `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P.
