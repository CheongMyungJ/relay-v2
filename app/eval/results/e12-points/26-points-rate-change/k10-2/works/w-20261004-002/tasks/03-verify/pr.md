# fix: 부분 환불 회수 포인트를 저장된 적립 − 남은 상품 재계산 적립(버림)으로 맞춘다

## 요약
부분 환불의 회수 포인트(`pointsRecovered`)가 정산팀 계산과 1~2P씩 어긋나던 문제를 고친다. O-1077 / R-0311은 131P에서 132P가 된다.

## 원인
`createRefund`가 환불 상품 금액의 적립률%를 반올림한 값으로 회수했다. 정산팀은 저장된 적립에서 남은 상품으로 다시 계산한 적립(버림)을 뺀다.

## 변경
- `src/money.js`: 버림 도우미 `floorPercentOf` 추가(`percentOf`는 그대로).
- `src/orders/refund.js`: 회수 = 회수 전 적립 − 남은 상품((남은 상품 − 쿠폰 − 사용 포인트)의 적립률% 버림). `alreadyRefunded`가 있으면 그때 남은 상품 기준으로 시작해 회수 합이 저장된 적립을 넘지 않는다.
- `docs/knowledge/points/earn-basis.md`: 부분 환불 회수 규칙을 갱신.
- 환불 금액, `cancelOrder`, `src/format/`, 저장된 `points.earned`는 바꾸지 않았다.

## 테스트
- `npm test`: 22개 통과.
- 새 테스트 2개: R-0311 132P, 두 번 부분 환불한 회수 합.
- `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 회수 -132P, 환불 금액 13,130원 그대로.
