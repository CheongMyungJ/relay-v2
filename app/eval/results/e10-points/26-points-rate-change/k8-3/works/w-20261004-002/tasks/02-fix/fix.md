## 재현
- 재현 절차: `createRefund(examples/O-1077.json, examples/R-0311.json)`을 node로 호출 (`node -e` 로 두 JSON을 읽어 호출)
- 결과: 재현됨
- 기대: `pointsRecovered` 132
- 실제: `pointsRecovered` 131 (`refundAmount` 13130)

## 원인
- 원인: 회수 포인트를 환불 상품 금액의 1%를 반올림(`percentOf(refundGoods, 1)` = 131.3→131)으로 구해, 쿠폰·사용 포인트를 뺀 적립 기준과 버림 규칙을 따르지 않았다.
- 근거: 수정 전 `src/orders/refund.js:34`. 정산 규칙으로 계산하면 남은 상품 34180 − 5000 − 2000 = 27180 → 271, 403 − 271 = 132. 수정 후 R-0311이 132로 나옴(테스트 통과).
- 사람 추정 판정: 없음
- 기각한 가설: 단순 환불 금액 × 1% 올림 — 사람이 아니라고 함(intake)

## 변경 요약
- `src/orders/refund.js` — 회수 포인트를 `earnedBefore − earnedOn(남은 상품)`으로 변경. `earnedOn`은 (상품 − 쿠폰 − 사용 포인트)×적립률%를 버림. 앞선 부분 환불(`alreadyRefunded`)이 있으면 `earnedBefore`를 그 환불 직전 상품 금액으로 다시 계산한 적립으로 두어 앞선 회수분이 중복되지 않게 함. 없으면 주문에 저장된 `points.earned`. `refundAmount`, `cancelOrder`, `src/format/`은 그대로.
- `test/refund.test.js` — 테스트 2개 추가(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: `test/refund.test.js` 마지막 2개 (R-0311 132P, 앞선 환불이 있는 경우 83P)
- 수정 전: 실패 — refund.js를 기준 커밋 것으로 되돌리고 `npm test`: pass 20 / fail 2 (not ok 21, 22)
- 수정 후: 통과 — `npm test`: pass 22 / fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 모두 통과
- 실패 항목: 없음
