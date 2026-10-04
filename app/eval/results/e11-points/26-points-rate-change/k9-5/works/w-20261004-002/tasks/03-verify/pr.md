# fix: 부분 환불 회수 포인트를 환불 전후 기준액 적립 차이(버림)로 계산

## 요약
부분 환불 때 회수하는 포인트가 정산팀 계산과 1~2P씩 어긋나던 문제를 고쳤다. 예: O-1077/R-0311은 131P가 아니라 132P를 회수한다.

## 원인
`createRefund`가 환불 상품금액(13,130원)의 1%를 반올림해 회수했다. 팀 규칙은 환불 전·후 기준액(상품금액 − 쿠폰 − 사용 포인트, 배송비 제외)을 각각 원 단위로 버림 적립한 값의 차이인데, 쿠폰·사용 포인트가 반영되지 않고 반올림·버림도 달랐다.

## 변경
- `src/money.js`: 원 단위 버림 `floorPercentOf` 추가
- `src/orders/refund.js`: `pointsRecovered = floor(환불 전 기준액×율) − floor(환불 후 기준액×율)`. 이미 환불한 수량(`alreadyRefunded`)은 환불 전 기준액에서 뺀다. `refundAmount`, `cancelOrder`, 영수증 글자는 그대로다.
- `test/refund.test.js`: 테스트 2개 추가 (기존 테스트 변경 없음)

## 테스트
- `npm test`: 22개 통과
- O-1077/R-0311: `refundAmount` 13,130원, `pointsRecovered` 132P (수정 전 131P)
- 영수증 출력은 `포인트 회수` 줄(-131P → -132P)만 달라진다.
- 주의: 앞 Work(w-20261004-001) 머지 시 `floorPercentOf`가 중복될 수 있다.
