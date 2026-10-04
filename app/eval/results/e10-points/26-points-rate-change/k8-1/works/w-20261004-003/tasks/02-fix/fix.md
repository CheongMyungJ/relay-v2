## 재현
- 재현 절차: `node -e "import('./src/orders/order.js').then(async m=>{const o=m.createOrder(JSON.parse(require('fs').readFileSync('examples/O-1107.json')));console.log(o.amounts.total,o.points.earned)})"` 또는 `node --test test/earn.test.js`
- 결과: 재현됨
- 기대: O-1107 적립 486P (상품−쿠폰−포인트 24,330원 × 2%, 버림), 선물하기도 같은 값
- 실제: 적립률 1%, 결제 금액(total 27,330, 배송비 포함) 기준 반올림이라 273P. 값만 2로 바꾸면 547P(배송비 포함)가 되어 486P가 안 된다

## 원인
- 원인: 적립이 `POINT_RATE_PERCENT=1`을 결제 금액 total에 `percentOf`(반올림)로 곱하고, 선물하기(`gift-points.js`)와 환불 회수(`refund.js`)가 같은 상수를 따로 쓴다. 규정(기준 금액·버림)과 적립률이 코드에 반영돼 있지 않고 한 곳에 모여 있지 않다.
- 근거: `src/points/earn.js`(수정 전) `percentOf(order.amounts.total, POINT_RATE_PERCENT)`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`, `src/money.js:13` 반올림. 수정 전 `node --test test/earn.test.js`에서 4건 실패. O-1107 total=27,330 확인. 상수만 바꾸는 실험은 안 함(계산으로 547P 확인).
- 사람 추정 판정: "요청의 486P는 규정으로 맞는 값" — 맞음. 27,350−2,000−1,020=24,330 → 2% = 486.6 → 486 (테스트로 확인)
- 기각한 가설: 상수만 2로 변경 — 배송비 포함·반올림이라 547P, 환불 회수도 같이 2%로 바뀜

## 변경 요약
- src/config.js — `EARN_RATE_PERCENT=2` 추가, 환불 회수율 `REFUND_RECOVER_PERCENT=1`로 분리(현행 유지)
- src/points/earn.js — `earnBase`/`earnOn`/`earnPoints`로 규정 구현(배송비 제외, 1P 미만 버림)
- src/gift/gift-points.js — `earnPoints`를 쓰도록 변경
- src/orders/refund.js — 회수는 `REFUND_RECOVER_PERCENT`(1%, 기존 반올림 방식) 사용. 계산 결과 불변
- (기존 테스트 변경) test/order.test.js — 50,000원 주문 적립 기대값 500→1000 (2% 반영)
- (기존 테스트 변경) test/gift.test.js — 30,000원 선물 적립 기대값 300→600 (2% 반영)

## 재현 테스트
- 위치: test/earn.test.js (O-1107 486P, 배송비 제외, 선물하기, earnPoints, 환불 회수 불변)
- 수정 전: 실패 (`node --test` → 신규 5건 중 4건 fail, 환불 회수 불변 테스트는 통과)
- 수정 후: 통과 (`npm test` → pass 25, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 25개 통과, 0 실패
- 실패 항목: 없음
