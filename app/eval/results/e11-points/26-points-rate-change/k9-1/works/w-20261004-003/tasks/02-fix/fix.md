## 재현
- 재현 절차: `node -e "import('./src/orders/order.js').then(async m=>{const fs=await import('fs');console.log(m.createOrder(JSON.parse(fs.readFileSync('examples/O-1107.json'))).points.earned)})"` (적립률만 2로 바꾼 경우도 같은 방식으로 확인)
- 결과: 재현됨
- 기대: O-1107 적립 486P
- 실제: 수정 전 1% 기준으로 273P(배송비 포함 27,350−2,000−1,020+3,000 = 27,330원, 반올림). 상수만 2로 바꾸면 547P(배송비 포함, 반올림)가 되어 486P와 어긋남.

## 원인
- 원인: 적립 포인트가 `POINT_RATE_PERCENT`(1%)로 배송비 포함 결제 금액을 반올림해 계산한다. 목표는 2%이고, 제약(팀 지식 earn-points-basis)은 배송비 제외·버림이다. 또 `refund.js`가 같은 상수를 써서 상수만 올리면 환불 회수도 함께 바뀐다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`(`percentOf(order.amounts.total, …)`, `src/money.js`의 `Math.round`), `src/orders/refund.js:34`. 실험: 수정 전 재현 테스트 2건 실패, 수정 후 통과. 24,330 × 2% = 486.6 → 486.
- 사람 추정 판정: O-1107의 486P는 24,330원의 2% 버림이라는 추정 — 맞음. 수정 후 O-1107이 486P로 나옴.
- 기각한 가설: 상수만 1→2로 바꾸면 된다 — 배송비 포함·반올림이라 547P가 되어 486P와 다르고, 환불 회수도 바뀐다.

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT`를 2로, 환불 전용 `REFUND_RECOVERY_RATE_PERCENT = 1`을 추가해 회수 계산이 변경 전과 같게 유지
- src/points/earn.js — (상품 − 쿠폰 − 사용 포인트)의 적립률%를 원 단위 버림 (배송비 제외)
- src/gift/gift-points.js — `earnPoints`에 위임해 선물하기도 같은 규칙
- src/orders/refund.js — 회수에 `REFUND_RECOVERY_RATE_PERCENT` 사용 (계산식은 그대로)
- (기존 테스트 변경) test/order.test.js — 25,000×2 주문 적립 기대값 500 → 1000 (2%)
- (기존 테스트 변경) test/gift.test.js — 30,000원 선물 적립 기대값 300 → 600 (2%)

## 재현 테스트
- 위치: test/earn-rate.test.js (O-1107 486P, G-0213 437P, 환불 회수 불변 29P)
- 수정 전: 실패 — `node --test test/earn-rate.test.js` 2건 실패(O-1107, G-0213), 환불 회수 테스트는 변경 전 값을 고정하는 보호용이라 통과
- 수정 후: 통과 — `npm test` 23건 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 23개 통과, 0개 실패
- 실패 항목: 없음
