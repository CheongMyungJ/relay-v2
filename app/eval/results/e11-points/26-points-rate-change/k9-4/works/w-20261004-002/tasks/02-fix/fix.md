## 재현
- 재현 절차: 수정 전 `src/orders/refund.js`로 `createRefund(O-1077.json, R-0311.json)` 실행 (`test/refund.test.js`의 새 테스트가 같은 입력)
- 결과: 재현됨
- 기대: 환불 금액 13130, 회수 포인트 132P
- 실제: 환불 금액 13130, 회수 포인트 131P

## 원인
- 원인: `pointsRecovered`를 환불 상품 금액(13130)에 `percentOf`(반올림)로 계산해 131.3→131이 됐다. 규칙은 환불 전 적립(403) − 환불 후 적립(남은 상품 34180−쿠폰 5000−사용 2000=27180 → 271.8을 버림해 271)=132이다.
- 근거: `src/orders/refund.js`(수정 전 `pointsRecovered: percentOf(refundGoods, ...)`). 수정 후 새 테스트가 132로 통과, 수정 전 코드에서는 실패. 쿠폰·사용 포인트를 환불분이 아닌 남은 주문에 반영하지 않고 반올림하는 것이 어긋남의 원인이며, 환불분이 1%에서 딱 떨어지는 경우(기존 테스트)는 어긋나지 않는다.
- 사람 추정 판정: 요청이 가리킨 위치 `src/orders/refund.js` — 맞음 — 원인이 그 파일의 `createRefund`에 있다
- 기각한 가설: 없음

## 변경 요약
- src/orders/refund.js — 회수 포인트를 (환불 전 적립 − 환불 후 적립)으로 계산. 환불 후 적립은 (남은 상품 금액 − 쿠폰 − 사용 포인트)의 `POINT_RATE_PERCENT`%를 버림. 첫 환불의 환불 전 적립은 저장된 `points.earned`. 환불 금액·`cancelOrder`·`src/format/`은 그대로
- test/refund.test.js — O-1077/R-0311 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/refund.test.js 마지막 테스트
- 수정 전: 실패 (`npm test` → 21개 중 1개 실패, 회수 131 ≠ 132)
- 수정 후: 통과 (`npm test` → 21 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 21 pass, 0 fail
- 실패 항목: 없음
