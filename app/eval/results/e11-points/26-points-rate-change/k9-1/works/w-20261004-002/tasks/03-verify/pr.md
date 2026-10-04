# fix: 부분 환불 회수 포인트를 원 적립 − 남은 상품 재계산 적립(버림)으로 계산

## 요약
부분 환불 때 회수하는 포인트가 정산팀 계산과 1~2P 어긋나던 것을 고쳤다. O-1077/R-0311은 131P에서 132P가 된다. 환불 금액(13,130원)과 영수증은 그대로다.

## 원인
`createRefund`가 원래 적립·쿠폰·사용 포인트를 쓰지 않고 환불 상품 금액에 `percentOf`(반올림)를 적용했다.

## 변경
- `src/money.js`: 버림 도우미 `percentFloor` 추가
- `src/orders/refund.js`: 회수 = 원 적립 − 남은 상품 재계산 적립((남은 상품 − 쿠폰 − 사용 포인트)의 적립률%, 버림, 배송비 제외). 이전 환불이 있으면 그때까지의 회수분을 빼 중복 회수를 막는다.
- `docs/knowledge/points/partial-refund-recovery-not-proportional.md`: 새 회수 규칙으로 고침

## 테스트
- `npm test` 22개 통과
- 신규: O-1077/R-0311 132P, 여러 번 환불 66P (수정 전 실패 확인)
- CLI `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 회수 -132P
