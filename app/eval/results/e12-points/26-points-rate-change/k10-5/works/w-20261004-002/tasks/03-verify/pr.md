# fix: 부분 환불 회수 포인트를 저장된 적립 − 남은 상품 재계산 적립(버림)으로 계산

## 요약
부분 환불 회수 포인트(`pointsRecovered`)가 정산팀 계산과 1~2P씩 어긋나던 문제를 고친다. R-0311(O-1077)은 131P → 132P가 된다.

## 원인
`createRefund`가 환불 상품 금액의 1%를 반올림(`percentOf`)해 회수했다. 쿠폰과 사용 포인트가 낀 주문에서는 저장된 `points.earned`와 남은 상품 재계산 적립의 차이와 달라 반올림 때문에 어긋났다.

## 변경
- `src/orders/refund.js`: 회수 = `order.points.earned − floorPercentOf(남은 상품 − 쿠폰 − 사용 포인트, POINT_RATE_PERCENT)`. `refundAmount`와 `cancelOrder`는 그대로
- `src/money.js`: 버림 함수 `floorPercentOf` 추가(`percentOf`는 다른 호출처가 있어 유지)
- `docs/knowledge/points/earn-basis.md`: 부분 환불 회수 기준 반영(비율 안분 방식 대체)
- 알려진 한계: 여러 번 나눠 환불하면 회수 합계가 earned를 넘을 수 있음(팀 지식에 미정 사항으로 기록)

## 테스트
- `npm test`: 22개 통과
- 추가: R-0311 132P, `alreadyRefunded` 포함 케이스(수정 전 실패 확인). 기존 테스트 변경 없음
- 재현: O-1077 / R-0311 → `pointsRecovered` 132
