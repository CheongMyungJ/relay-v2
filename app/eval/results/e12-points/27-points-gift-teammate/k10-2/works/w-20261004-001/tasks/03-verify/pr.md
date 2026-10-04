# 일반 주문 적립 포인트를 배송비 제외 금액 기준 버림으로 계산

## 요약
일반 주문의 적립 예정 포인트가 적립 안내보다 많게 나오던 것을 바로잡았다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비가 포함된 결제 금액의 1%를 반올림했다. 적립 안내는 배송비를 뺀 금액의 1%를 원 단위 버림으로 계산한다.

## 변경
- `src/points/earn.js`: `(total - shipping)`의 1%를 `Math.floor`로 계산. 공용 `percentOf`는 그대로 둠.
- `test/order.test.js`: O-1042(237P)와 버림 경계(배송비 0원, 350.5P → 350P) 테스트 추가.
- `docs/knowledge/`: 적립 규칙과 저장된 적립값·영수증 글자 규칙 기록.
- 손대지 않음: 저장된 `points.earned`, `src/format/`, `src/gift/gift-points.js`.

## 테스트
- `npm test`: 22개 통과.
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P.
- 남은 점: 부분 환불 회수 포인트(`src/orders/refund.js`)와 선물하기 적립은 옛 방식(반올림)이라 별도로 다뤄야 한다.
