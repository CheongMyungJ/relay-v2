# 일반 주문 적립 포인트를 배송비 제외, 원 단위 버림으로 계산

## 요약
일반 주문의 적립 예정 포인트가 고객센터 계산보다 많게 나오던 문제를 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비를 포함한 결제 금액에 `percentOf`(반올림)를 적용했다. 고객센터 기준은 배송비를 뺀 금액의 1%이며 원 단위 미만을 버린다.

## 변경
- `src/points/earn.js`: `total − shipping`의 1%를 `Math.floor`로 계산
- `src/orders/refund.js`: 부분 환불 회수 포인트도 같은 버림으로 계산
- `docs/knowledge/points/earn-points-rule.md`: 적립 규칙 기록
- 영수증(`src/format/`), 선물하기 적립(`src/gift/`), 저장된 `points.earned`는 바꾸지 않았다.

## 테스트
- `npm test` 21개 통과
- `test/order.test.js`에 O-1042 적립 237P 테스트 추가
- `node src/cli.js examples/O-1042.json | grep 적립` → 237P
