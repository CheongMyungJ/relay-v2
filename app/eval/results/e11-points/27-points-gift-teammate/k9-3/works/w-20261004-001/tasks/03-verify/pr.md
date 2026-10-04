# 일반 주문 적립 포인트에서 배송비를 빼고 소수는 버린다

## 요약
O-1042의 적립 예정 포인트가 268P로 나오던 것을 고객센터 계산과 같은 237P가 되게 고쳤다.

## 원인
`earnPoints`가 배송비가 포함된 결제 금액(`amounts.total`)에 `percentOf`(반올림)를 적용했다. 배송비가 붙는 주문만 많게 나왔다.

## 변경
- `src/points/earn.js`: 기준을 `total - shipping`으로 하고 원 미만은 버린다. `percentOf`는 환불 회수에서도 써서 건드리지 않았다.
- `test/earn.test.js`: O-1042 237P와 배송비 없는 주문 500P 테스트 추가.
- `docs/knowledge/points/`: 적립 기준과 저장된 `points.earned` 규칙 기록.
- 선물하기 적립, 영수증, 저장된 `points.earned` 경로는 바꾸지 않았다.

## 테스트
- `npm test`: 22개 모두 통과
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
- 남은 위험: 기준은 O-1042 한 건에서 역산했고, 부분 환불 회수(`src/orders/refund.js:34`)는 반올림이다.
