# fix: 적립 포인트는 배송비를 빼고 원 단위 버림으로 계산

## 요약
주문 적립 예정 포인트가 고객센터 안내보다 많게 나오던 문제를 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비가 포함된 결제 금액(26,770원)에 반올림을 적용했다. 배송비를 빼고(23,770원) 버림해야 한다. 선물하기와 부분 환불 회수도 같은 계산을 따로 갖고 있었다.

## 변경
- `src/money.js`: 버림 도우미 `percentFloor` 추가, 쓰이지 않게 된 `percentOf` 삭제
- `src/points/earn.js`: (total − shipping)의 적립률%를 버림
- `src/gift/gift-points.js`: `earnPoints`를 그대로 사용
- `src/orders/refund.js`: 부분 환불 회수도 버림
- `docs/knowledge/points/`: 적립 기준 규칙과 부분 환불 회수 주의점
- 적립률 값과 과거 주문은 건드리지 않음

## 테스트
- `npm test`: 24개 통과
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
- 추가: O-1042 237P, 배송비 유·무, 선물하기, 부분 환불 회수 테스트
