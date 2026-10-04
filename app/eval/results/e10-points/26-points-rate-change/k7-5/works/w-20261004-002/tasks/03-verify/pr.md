# fix: 부분 환불 회수 포인트를 원래 적립 − 남은 상품 기준 재계산 적립(버림)으로 계산

## 요약
부분 환불의 `pointsRecovered`가 정산팀 계산과 1~2P씩 어긋나던 문제를 고쳤다. O-1077/R-0311은 131P에서 132P가 된다.

## 원인
`createRefund`가 환불 상품 금액의 1%를 반올림해 회수 포인트로 삼았다. 쿠폰·사용 포인트·원래 적립 기준과 달라 차이가 났다.

## 변경
- `src/money.js`: 버림 방식 `floorPercentOf` 추가
- `src/orders/refund.js`: 회수 = max(0, 저장된 적립 − floor((남은 상품 − 쿠폰 − 사용 포인트) × 1%)). `refundAmount`는 그대로
- `docs/knowledge/partial-refund-points-recovery.md`: 규칙 기록
- 영수증의 회수 포인트 줄 값이 바뀐다(-131P → -132P). 환불 금액과 `src/format/`은 그대로
- 주의: `alreadyRefunded`가 있으면 이전 환불에서 이미 회수한 포인트까지 다시 회수하는 누적값이 된다

## 테스트
- `npm test`: 23개 통과
- 추가: O-1077/R-0311(132P), `alreadyRefunded`(195P), 0 하한. 기존 테스트는 변경 없음
