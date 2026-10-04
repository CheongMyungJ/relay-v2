# fix: 부분 환불 회수 포인트를 저장된 적립 − 남은 상품 기준 재계산 적립(버림)으로 수정

## 요약
부분 환불 때 회수 포인트가 정산팀 계산과 달랐다. O-1077/R-0311은 131P가 아니라 132P를 회수해야 한다.

## 원인
`createRefund`가 환불 상품 금액의 1%를 반올림해 회수했다. 쿠폰·사용 포인트를 반영하지 않았고 저장된 적립과의 차이 방식도 아니었다.

## 변경
- `src/orders/refund.js`: 회수 = `points.earned` − floor((남은 상품 금액 − 쿠폰 − 사용 포인트)의 1%). `alreadyRefunded`도 남은 금액에서 뺀다. 0 미만이 되지 않게 하한을 둔다. `refundAmount`와 `src/format/`은 그대로.
- `test/refund.test.js`: 테스트 2개 추가(132P, alreadyRefunded 케이스 213P)
- `docs/knowledge/points/earn-rule.md`: 환불 회수 규칙 추가, 고친 곳 반영

## 테스트
- `npm test`: 22개 통과
- O-1077/R-0311 직접 실행: pointsRecovered 132
