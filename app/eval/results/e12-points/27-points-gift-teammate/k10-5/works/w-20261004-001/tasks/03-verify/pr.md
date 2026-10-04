# fix: 적립 예정 포인트를 배송비·사용 포인트를 뺀 금액 기준으로 계산

## 요약
주문의 적립 예정 포인트가 고객센터 계산보다 많게 나오던 문제를 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`src/points/earn.js`가 배송비를 포함한 결제 금액(`amounts.total`)의 1%를 반올림했다. 고객센터 기준은 `상품 − 쿠폰 − 사용 포인트`(배송비 제외)의 1%를 원 단위로 내림한 값이다.

## 변경
- `src/points/earn.js`: 기준 금액을 `goods − coupon − pointsUsed`로 바꾸고 `Math.floor`로 내림한다. 공용 `percentOf`는 선물하기 적립과 환불도 쓰므로 고치지 않았다.
- `test/order.test.js`: O-1042 재현 테스트를 추가했다.
- `docs/knowledge/points/earn-points-basis.md`: 적립 기준 규칙과 아직 따르지 않는 곳을 남겼다.
- 선물하기 적립(`src/gift/`)과 영수증 형식(`src/format/`)은 바꾸지 않았다.

## 테스트
- `node src/cli.js examples/O-1042.json | grep 적립` → 237P
- `npm test` → 21개 통과
- 남은 위험: 규칙은 O-1042 한 건에서 역산했다. 부분 환불 회수(`src/orders/refund.js:34`)는 반올림이라 1P 어긋날 수 있다.
