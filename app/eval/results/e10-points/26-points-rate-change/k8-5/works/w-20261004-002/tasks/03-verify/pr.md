# fix: 부분 환불 회수 포인트를 저장된 적립 − 남은 상품 기준 적립(버림)으로 계산

## 요약
부분 환불의 `pointsRecovered`를 정산팀 기준에 맞춘다. O-1077/R-0311은 131P가 아니라 132P를 회수한다.

## 원인
`createRefund`가 환불분 금액(13,130원)만 따로 1% 해서 반올림(`percentOf`)했다. 정산팀 기준은 저장된 적립에서 남은 상품으로 다시 계산한 적립을 빼는 방식이라 1P 어긋났다.

## 변경
- `src/money.js`: 버림 퍼센트 `floorPercentOf` 추가 (`percentOf`는 다른 코드가 쓰므로 그대로)
- `src/orders/refund.js`: 회수 = `max(0, points.earned − floor((남은 상품 − 쿠폰 − 사용 포인트) × 비율))`. 배송비 제외, `refundAmount` 불변
- `docs/knowledge/points/earn-rule.md`: 부분 환불 회수 규칙 추가
- 범위 밖: 전체 취소, `earnPoints`, `src/format/`

## 테스트
- `npm test`: 21개 통과
- 새 테스트(O-1077/R-0311, 132P, `refundAmount` 13,130)는 수정 전 실패(131)
- 알려진 위험: 같은 주문에 부분 환불이 여러 번이면 중복 회수 가능 (입력에 이전 회수분이 없어 의도 식 그대로 구현)
