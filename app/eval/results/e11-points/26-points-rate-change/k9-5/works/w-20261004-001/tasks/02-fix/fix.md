## 재현
- 재현 절차: `node -e "import('./src/orders/order.js').then(m=>console.log(m.createOrder(JSON.parse(require('fs').readFileSync('examples/O-1042.json'))).points.earned))"` (또는 새 테스트 실행)
- 결과: 재현됨
- 기대: 237
- 실제: 268 (결제금액 26,770의 1%를 반올림)

## 원인
- 원인: 적립이 배송비가 포함된 결제금액(`amounts.total`)에 `percentOf`(반올림)를 적용해서, 안내 규칙(배송비 제외, 버림)보다 많이 나온다. 선물하기와 환불 회수도 같은 방식이다.
- 근거: `src/points/earn.js`, `src/gift/gift-points.js`, `src/orders/refund.js`가 `percentOf`(반올림)를 썼다. 수정 전 새 테스트 3건 실패, 수정 후 통과. 배송비가 0인 주문은 반올림 차이만 났다.
- 사람 추정 판정: 없음
- 기각한 가설: 배송비만 제외하고 반올림 유지 — O-1042가 238P가 되어 237P와 맞지 않음(intake에서 기각)

## 변경 요약
- `src/money.js` — 버림 도우미 `floorPercentOf` 추가
- `src/points/earn.js` — `earnBase`(상품−쿠폰−사용포인트), `earnOnBase`(버림) 추가, `earnPoints`가 이를 사용
- `src/gift/gift-points.js` — `earnPoints`를 그대로 사용해 일반 주문과 같은 규칙
- `src/orders/refund.js` — 부분 환불 회수를 `earnOnBase(환불 전 기준액) − earnOnBase(환불 후 기준액)`로 계산. 나눠 환불해도 합계가 남은 주문의 적립과 어긋나지 않는다. `cancelOrder`와 영수증은 저장값을 써서 그대로.

## 재현 테스트
- 위치: `test/order.test.js`(O-1042), `test/gift.test.js`(G-0213 → 218), `test/refund.test.js`(회수 3건)
- 수정 전: 실패 (소스만 되돌리고 `npm test`: 새 테스트 3건 실패 — O-1042, G-0213, 환불 반올림 케이스. 나머지 환불 테스트 2건은 수정 전에도 통과, 회귀 방지용)
- 수정 후: 통과 (`npm test`: 25 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 25 pass, 0 fail (기존 20건은 변경 없음)
- 실패 항목: 없음
