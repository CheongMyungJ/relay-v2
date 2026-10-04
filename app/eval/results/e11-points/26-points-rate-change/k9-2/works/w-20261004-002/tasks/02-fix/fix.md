## 재현
- 재현 절차: `examples/O-1077.json` 주문에 `examples/R-0311.json`(SP-0656 ×2)로 `createRefund`를 호출. 재현 테스트 `npm test`(test/refund.test.js 21번)로 확인
- 결과: 재현됨
- 기대: pointsRecovered 132 (403 − 271)
- 실제: 131 (환불 상품 금액 13,130원의 1%를 반올림)

## 원인
- 원인: `createRefund`가 회수 포인트를 환불 상품 금액의 1%(`percentOf`, Math.round)로 계산한다. 저장된 적립과 남은 상품 기준 재계산 적립의 차이가 아니고, 쿠폰·사용 포인트도 반영하지 않으며, 반올림을 쓴다.
- 근거: 수정 전 `src/orders/refund.js:35` `percentOf(refundGoods, POINT_RATE_PERCENT)`. 수정 전 코드에서 새 테스트 2개 실패(131≠132, alreadyRefunded 케이스 84≠213). 기존 테스트가 통과한 것은 쿠폰·사용 포인트가 0이고 정수로 떨어지는 값이라 두 방식이 우연히 같았기 때문.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/orders/refund.js — 회수 포인트를 `order.points.earned − floor((remainingGoods − coupon − pointsUsed) × 1%)`로 변경. 음수가 되지 않도록 0으로 하한. 불필요해진 `percentOf` import 제거. `refundAmount`는 그대로.
- test/refund.test.js — 테스트 2개 추가(기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/refund.test.js (O-1077/R-0311 → 132P, alreadyRefunded 케이스 → 213P)
- 수정 전: 실패 (기준 커밋의 src로 `npm test`: pass 20 / fail 2, 131≠132 및 84≠213)
- 수정 후: 통과 (`npm test`: pass 22 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: pass 22, fail 0
- 실패 항목: 없음
