## 재현
- 재현 절차: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`
- 결과: 재현됨
- 기대: 포인트 회수 132P (정산팀 계산), 환불 금액 13,130원
- 실제: 포인트 회수 -131P

## 원인
- 원인: `createRefund`가 환불 상품 금액만 따로 1% 반올림(`percentOf(refundGoods, 1)`)해서, 쿠폰·사용 포인트가 남은 주문에 그대로 있는 경우의 적립 기준((상품−쿠폰−사용 포인트)의 1%, 버림)과 어긋난다.
- 근거: `src/orders/refund.js:35` (수정 전). 13,130 × 1% = 131.3 → 131. 적립 기준으로는 환불 후 남은 기준 금액 47,310−13,130−5,000−2,000 = 27,180 → 271P, 적립 403 − 271 = 132P. 수정 후 CLI가 132P를 출력. 쿠폰·사용 포인트가 없는 기존 테스트(10,000원 → 100P)는 두 방식이 같아서 어긋나지 않는다.
- 사람 추정 판정: 추정 — `src/orders/refund.js`가 원인 위치 — 맞음 — 35줄의 회수 계산이 원인이었다.
- 기각한 가설: 없음

## 변경 요약
- src/points/earn.js — 적립 기준 함수 `earnFromAmounts` 추가(팀 지식 earn-base.md의 이름). `earnPoints`(저장된 적립 계산)는 건드리지 않음.
- src/orders/refund.js — `pointsRecovered`를 환불 전 기준 적립 − 환불 후 기준 적립(둘 다 버림)으로 계산. 여러 번 나눠 환불해도 합이 어긋나지 않는다. `refundAmount`, `cancelOrder`는 그대로.
- test/refund.test.js — O-1077/R-0311 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/refund.test.js 마지막 테스트
- 수정 전: 실패 (`npm test` → 1 fail, pointsRecovered 131 ≠ 132)
- 수정 후: 통과 (`npm test` → 21 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 21 pass, 0 fail
- 실패 항목: 없음
