## 재현
- 재현 절차: `node src/cli.js examples/O-1107.json` (선물: `examples/G-0213.json`, 환불: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`)
- 결과: 재현됨
- 기대: O-1107 적립 486P
- 실제: 273P (결제 금액 27,330 × 1% 반올림). G-0213은 249P, R-0311 회수는 131P

## 원인
- 원인: 적립률이 1%(`POINT_RATE_PERCENT`)이고, 적립 금액을 배송비 포함·사용 포인트 차감한 결제 금액(`amounts.total`)에 `percentOf`(반올림)로 계산했다. 규정은 (상품 금액 − 쿠폰 − 사용 포인트)의 비율, 버림이다. 같은 상수를 환불(`refund.js`)도 써서 상수만 바꾸면 환불 회수가 같이 바뀐다.
- 근거: `src/points/earn.js`, `src/gift/gift-points.js`가 `amounts.total` 사용. 수정 전 CLI 출력 273P. 수정 뒤 486P, 환불 131P 그대로. 상수만 2로 바꾸면 547P가 나온다(계산으로 확인, 실행 안 함).
- 사람 추정 판정: 없음
- 기각한 가설: 상수만 2로 변경 — 배송비 포함 금액 기준이라 547P가 되고 환불 회수도 같이 바뀐다

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT`를 `EARN_RATE_PERCENT = 2`와 `REFUND_RATE_PERCENT = 1`로 나눔
- src/points/earn.js — 적립 = floor((상품 − 쿠폰 − 사용 포인트) × 2%), 배송비 제외
- src/gift/gift-points.js — 일반 주문과 같은 `earnPoints` 사용
- src/orders/refund.js — `REFUND_RATE_PERCENT`(1%) 사용. 계산 방식(반올림)은 그대로
- (기존 테스트 변경) test/order.test.js — 50,000원 주문 적립 기대값 500 → 1000 (2% 적용)
- (기존 테스트 변경) test/gift.test.js — 30,000원 선물 적립 기대값 300 → 600 (2% 적용)

## 재현 테스트
- 위치: test/order.test.js(O-1107 486P), test/gift.test.js(G-0213 437P), test/refund.test.js(R-0311 회수 131P)
- 수정 전: 실패 — `src`를 기준 커밋으로 되돌리고 `npm test`: 23건 중 4건 실패(O-1107 486P, G-0213 437P, 변경한 기존 기대값 2건). 환불 테스트는 통과
- 수정 후: 통과 — `npm test` 23건 통과
- 환불 테스트는 변경 전에도 통과한다(동작 유지 확인용)

## 테스트 실행
- 명령: `npm test`
- 결과: 23개 통과, 0개 실패. `src/format/` 변경 없음
- 실패 항목: 없음
