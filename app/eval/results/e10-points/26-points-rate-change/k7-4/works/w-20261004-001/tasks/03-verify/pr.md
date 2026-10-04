# fix: 적립 포인트를 배송비 제외 금액의 1% 버림으로 계산하고 환불 회수도 맞춤

## 요약
일반 주문의 적립 예정 포인트가 배송비를 포함한 결제 금액에 반올림으로 계산되던 것을, 배송비를 제외한 금액(상품 − 쿠폰 − 사용 포인트)의 1% 버림으로 고쳤다. O-1042는 268P에서 237P가 된다. 환불 회수도 같은 기준으로 맞췄다.

## 원인
`earnPoints`가 배송비가 포함된 `amounts.total`에 `percentOf`(반올림)를 적용했다. 환불 회수도 반올림이라 나눠 환불하면 회수 합계가 적립을 넘을 수 있었다.

## 변경
- `src/points/earn.js`: 기준액을 상품 − 쿠폰 − 사용 포인트로, 버림으로 변경
- `src/money.js`: `floorPercentOf` 추가 (`percentOf`는 선물하기 적립이 써서 그대로)
- `src/orders/refund.js`: 부분 환불 회수를 적립 기준액 비례, 버림으로 변경
- `docs/knowledge/points-earn-basis-floor.md`: 적립 규칙 기록
- 저장된 `points.earned`, `src/format/`, 선물하기 적립, 적립률 값은 바꾸지 않았다.

## 테스트
- `npm test`: 25개 통과
- 추가: `test/earn.test.js`(O-1042 237P, 배송비 제외), `test/refund.test.js`(버림, 분할 환불 합계, 쿠폰·포인트 주문 회수)
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- 참고: 237P 식은 고객센터 안내 문서가 아니라 숫자에 맞춰 고른 것이다.
