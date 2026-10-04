# fix: 적립 예정 포인트에서 배송비를 제외하고 소수는 버린다

## 요약
적립 예정 포인트가 적립 안내보다 많게 나오는 버그를 고쳤다. 주문 O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비가 든 결제 금액(`amounts.total`)에 적립률을 곱하고 반올림했다. 적립 기준은 배송비를 뺀 금액(상품 - 쿠폰 - 사용 포인트)의 1%이고 1P 미만은 버린다.

## 변경
- `src/points/earn.js`: 기준 금액을 `total - shipping`으로, 반올림을 `Math.floor`로 바꿨다.
- `test/earn.test.js`: 재현 테스트를 추가했다.
- `docs/knowledge/points/`: 적립 기준과 선물하기 적립 소유 관련 지식을 남겼다.
- 저장된 `points.earned`, `src/format/`, `src/gift/gift-points.js`는 바꾸지 않았다.

## 테스트
- `npm test`: 22개 통과
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
- 알려진 위험: 기준은 O-1042 한 건에서 역산했다. 부분 환불 회수(`src/orders/refund.js:34`)와 선물하기 적립은 기준이 달라 따로 확인이 필요하다.
