# fix: 부분 환불 회수 포인트를 전후 적립의 차이로 계산

## 요약
부분 환불 때 회수하는 포인트가 정산팀 계산과 1~2P 어긋나던 문제를 고쳤다. O-1077의 R-0311은 131P에서 132P가 된다.

## 원인
회수 포인트를 환불 상품 금액(13,130원)의 1%를 반올림해 계산했다. 쿠폰·사용 포인트는 남은 주문에 그대로 있어 적립 기준 금액이 달라지므로, 따로 반올림하면 전후 적립의 차이와 어긋난다.

## 변경
- `src/orders/refund.js`: `earnedOn`을 추가하고 `pointsRecovered`를 "환불 전 남은 주문 적립 - 환불 후 남은 주문 적립"으로 바꿨다. `refundAmount`, 검증, 영수증 형식, 저장된 적립은 그대로다.
- `test/refund.test.js`: 테스트 2개를 추가했다.
- `docs/knowledge/points/earn-rule.md`: 회수 계산 규칙과 사례를 남겼다.
- `earnedOn`은 `earnPoints`와 중복이다. 앞 Work 머지 뒤 합쳐야 한다.

## 테스트
- `npm test`: 22개 통과, 0 실패
- `node src/cli.js examples/R-0311.json --order examples/O-1077.json`: 회수 -132P
