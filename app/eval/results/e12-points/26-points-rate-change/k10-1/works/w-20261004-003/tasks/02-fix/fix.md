## 재현
- 재현 절차: `node -e "import('./src/orders/order.js').then(async m=>{const o=m.createOrder(JSON.parse(require('fs').readFileSync('examples/O-1107.json')));console.log(o.amounts,o.points)})"` (수정 전 코드에서, 또는 `node --test test/earn.test.js`)
- 결과: 재현됨
- 기대: O-1107 적립 486P (24,330 × 2%, 1P 미만 버림)
- 실제: 수정 전에는 적립률 1%, 기준이 결제 금액(배송비 3,000 포함, `amounts.total` 27,330)이고 반올림이라 273P. 비율만 2%로 올려도 27,330 × 2% = 546.6 → 547P라 486P가 안 된다.

## 원인
- 원인: 적립이 `amounts.total`(배송비 포함)에 `POINT_RATE_PERCENT`(1%)를 곱해 반올림했다(`src/points/earn.js`, `src/gift/gift-points.js`). 기대값 486P는 팀 규칙의 기준 금액(상품 − 쿠폰 − 사용 포인트, 배송비 제외)과 버림으로만 나온다. 이 브랜치에는 `earnBase`가 없다(앞 Work w-20261004-002에서 고쳤을 수 있음, 머지 대기).
- 근거: O-1107은 상품 27,350 − 쿠폰 2,000 = 25,350 < 30,000이라 배송비 3,000이 붙는다(`createOrder` 출력 shipping 3000). 배송비가 있는 주문에서만 total과 기준 금액이 달라진다. 배송비 없는 주문(order.test 등)은 비율 변경만 영향.
- 사람 추정 판정: 없음
- 기각한 가설: 비율 상수만 2로 바꾸면 된다 — 계산하면 547P로 486P와 다르다. 환불 회수에도 새 비율을 쓴다 — 사람이 이번 범위 밖이라고 답함.

## 변경 요약
- src/config.js — 적립용 `EARN_RATE_PERCENT = 2` 추가. `POINT_RATE_PERCENT`는 1%로 그대로 두어 refund.js 동작을 바꾸지 않는다.
- src/points/earn.js — `earnBase`(상품 − 쿠폰 − 사용 포인트) 추가, 적립은 기준 금액 × 2% 버림.
- src/gift/gift-points.js — `earnPoints`와 같은 기준을 쓰게 함.
- README.md — 적립률 설정 이름 안내 수정.
- (기존 테스트 변경) test/order.test.js — 25,000×2 주문의 적립 기대값 500 → 1000 (2%).
- (기존 테스트 변경) test/gift.test.js — 30,000 주문의 적립 기대값 300 → 600 (2%).

## 재현 테스트
- 위치: test/earn.test.js (O-1107 일반 주문, 선물하기)
- 수정 전: 실패 (`node --test test/earn.test.js` — `earnBase` export 없음으로 실패. 값으로는 273P)
- 수정 후: 통과 (`node --test test/earn.test.js` — 2개 통과)
- 저장된 `points.earned`는 이 코드 어디서도 다시 계산하지 않아(영수증, 환불, cancelOrder가 저장값 사용) 별도 테스트는 추가하지 않았다.

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0 실패 (receipt.test.js는 수정 없이 통과)
- 실패 항목: 없음
