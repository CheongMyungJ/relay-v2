## 재현
- 재현 절차: `createRefund(O-1077, R-0311)` 호출 (`examples/O-1077.json`, `examples/R-0311.json`). 수정 전 코드에서 새 테스트 `npm test`로 확인
- 결과: 재현됨
- 기대: 회수 포인트 132P
- 실제: 131P (환불 금액 13,130 × 1% = 131.3 → 반올림 131)

## 원인
- 원인: `pointsRecovered`를 환불 상품 금액의 1%로 반올림해 계산했다. 정산팀 기준은 원래 적립 − 남은 상품(쿠폰·사용 포인트 반영)으로 다시 계산한 적립(버림)이라 1~2P씩 어긋난다.
- 근거: 수정 전 `src/orders/refund.js`의 `percentOf(refundGoods, POINT_RATE_PERCENT)`. 검산: 남은 34,180 − 5,000 − 2,000 = 27,180 → 271, 403 − 271 = 132. 수정 전 코드로 되돌리면 새 테스트가 실패하고(21번), 수정하면 통과한다.
- 사람 추정 판정: 없음 (추가 의견은 파일 지목뿐이며 `refund.js`가 맞음)
- 기각한 가설: 없음

## 변경 요약
- src/orders/refund.js — 남은 상품 기준 적립 계산(`earnedOnRemaining`, 버림)을 추가하고 회수 = 원래 적립 − 남은 적립으로 변경. 나눠 환불할 때는 이전 환불까지의 누적 회수를 빼서 합계가 원래 적립을 넘지 않게 함. `percentOf`(money.js)와 `refundAmount`는 그대로.
- test/refund.test.js — 테스트 2개 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/refund.test.js (O-1077 / R-0311, 나눠 환불)
- 수정 전: 실패 (`git stash`로 src만 되돌리고 `npm test` → `not ok 21`, 131 ≠ 132)
- 수정 후: 통과 (`npm test` → pass 22, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 모두 통과
- 실패 항목: 없음
