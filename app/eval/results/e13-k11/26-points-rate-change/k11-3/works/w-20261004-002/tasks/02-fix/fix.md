## 재현
- 재현 절차: `createRefund(O-1077, R-0311)` 실행 (`examples/O-1077.json`, `examples/R-0311.json`). 재현 테스트: `npm test`
- 결과: 재현됨
- 기대: 회수 포인트 132P (전 403P − 후 271P)
- 실제: 131P (`percentOf(13130, 1)` = 반올림 131.3 → 131)

## 원인
- 원인: `createRefund`가 환불 상품 금액의 1%를 반올림(`percentOf`)해 회수해서, 적립 기준(순 금액, 버림)의 전후 차이와 어긋난다.
- 근거: `src/orders/refund.js`의 `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`. 쿠폰·사용 포인트를 고려하지 않고 반올림한다. 수정 뒤 같은 입력이 132P로 바뀌어 통과했다(원인 코드 교체 실험).
- 사람 추정 판정: 문제는 `src/orders/refund.js`의 회수 포인트 계산에 있다 — 맞음 — 위 줄이 원인이고 수정도 그 파일에서 했다.
- 기각한 가설: 없음

## 변경 요약
- `src/orders/refund.js` — 회수 포인트를 (환불 전 남은 주문 적립) − (환불 후 남은 주문 적립)으로 계산. 적립은 (남은 상품 − 쿠폰 − 사용 포인트) × `POINT_RATE_PERCENT`% 버림. `alreadyRefunded`는 환불 전 금액에서 뺀다. `refundAmount`는 그대로. `earnPoints`는 건드리지 않았다.
- `test/refund.test.js` — 테스트 2개 추가(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: `test/refund.test.js` — 'O-1077/R-0311' 테스트, '나눠 부분 환불한 회수 포인트 합계' 테스트
- 수정 전: 실패 (`npm test`: expected 132, actual 131)
- 수정 후: 통과 (`npm test`: pass 22, fail 0)
- 나눠 환불 합계 테스트는 수정 전에도 통과했다(이 입력에서는 반올림 오차가 우연히 상쇄). 전후 차이 방식이라 합계가 항상 맞는다는 회귀 보호용이다.

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0개 실패
- 실패 항목: 없음
