## 재현
- 재현 절차: `node -e "import('./src/orders/order.js').then(async m=>{const o=m.createOrder(JSON.parse(require('fs').readFileSync('examples/O-1107.json')));console.log(o.points.earned)})"` 또는 `node --test test/earn-rate.test.js`
- 결과: 재현됨
- 기대: O-1107 적립 486P (27,350 − 2,000 − 1,020 = 24,330원의 2% 내림)
- 실제: 273P (결제 금액 27,330원의 1% 반올림). 선물하기 주문도 같은 방식

## 원인
- 원인: 적립률 `POINT_RATE_PERCENT`가 1이고(`src/config.js`), `earnPoints`/`giftPoints`가 배송비가 든 결제 금액(`amounts.total`)에 반올림 `percentOf`를 쓴다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`. 수정 전 `node --test test/earn-rate.test.js`에서 3건 실패(273 vs 486 등). `createRefund`가 같은 `POINT_RATE_PERCENT`를 import해(`src/orders/refund.js:34`) 값만 2로 바꾸면 환불 회수도 2%로 바뀐다. 환불 테스트 추가로 확인.
- 사람 추정 판정: 없음
- 기각한 가설: 환불 회수에도 2% 적용 — 비목표(정산팀과 따로 정함)라 환불 비율을 별도 상수 1로 분리해 유지

## 변경 요약
- `src/config.js` — `POINT_RATE_PERCENT`를 2로, 환불용 `POINT_RECOVERY_RATE_PERCENT = 1` 추가
- `src/money.js` — 내림 `floorPercentOf` 추가(`percentOf`는 그대로)
- `src/points/earn.js` — 적립 기준 `earnBase`(상품−쿠폰−사용 포인트, 배송비 제외)의 2% 내림
- `src/gift/gift-points.js` — `earnPoints`에 위임해 일반 주문과 같은 기준
- `src/orders/refund.js` — 회수 계산은 그대로, 비율만 `POINT_RECOVERY_RATE_PERCENT`(1)를 import
- (기존 테스트 변경) `test/order.test.js` — 상품 50,000원 주문의 기대 적립 500 → 1000 (2% 정책)
- (기존 테스트 변경) `test/gift.test.js` — 상품 30,000원 주문의 기대 적립 300 → 600 (2% 정책)

## 재현 테스트
- 위치: `test/earn-rate.test.js` (O-1107 486P, 선물하기, 내림, 환불 회수 불변)
- 수정 전: 실패 — `npm test`에서 3건 실패(적립 273 등), 환불 불변 테스트는 통과
- 수정 후: 통과 — `npm test` 24건 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 24 통과, 0 실패
- 실패 항목: 없음
