# fix: 부분 환불 회수 포인트를 저장된 적립 기준으로 계산

## 요약
부분 환불 때 회수 포인트가 정산팀 계산과 1~2P씩 어긋나던 문제를 고쳤다. O-1077 / R-0311은 131P에서 132P가 된다. 환불 금액(13,130원), `src/format/`, `cancelOrder`는 그대로다.

## 원인
`createRefund`가 환불 상품 금액만 따로 1% 반올림해서, 쿠폰·사용 포인트가 있는 주문의 적립 기준((상품−쿠폰−사용 포인트)의 1%, 버림)과 어긋났다.

## 변경
- `src/points/earn.js`: 적립 기준 함수 `earnFromAmounts` 추가
- `src/orders/refund.js`: 회수 포인트 = 저장된 `points.earned` − 남은 상품으로 계산한 적립. 저장된 적립은 재계산하지 않는다.
- `docs/knowledge/points/stored-earned-not-recalculated.md`: 부분 환불 회수 규칙 추가
- 연속 부분 환불(`alreadyRefunded`)에서 이전 회수분이 중복될 수 있다. 입력에 이전 회수 포인트가 없어 이번 범위에서 다루지 않았다.

## 테스트
- `npm test`: 23 pass, 0 fail
- `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 포인트 회수 -132P
- 추가: O-1077/R-0311, 저장된 earned가 재계산 값과 다른 경우, `alreadyRefunded` 환불 금액
