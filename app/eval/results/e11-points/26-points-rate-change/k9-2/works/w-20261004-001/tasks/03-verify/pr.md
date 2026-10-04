# 적립 포인트를 배송비 제외, 1P 미만 버림으로 계산

## 요약
주문의 적립 예정 포인트가 적립 규정(상품 금액 − 쿠폰 − 사용 포인트의 1%, 배송비 제외, 1P 미만 버림)대로 계산되게 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비를 포함한 결제 금액(`amounts.total`)에 반올림(`percentOf`)을 적용했다. 배송비가 기준에 들어가고 1P 미만이 반올림되었다. 기존 테스트는 배송비가 없고 나누어떨어지는 주문만 써서 잡지 못했다.

## 변경
- `src/points/earn.js`: 기준을 `total - shipping`으로 하고 `Math.floor`로 버림. 쓰지 않는 `percentOf` import 제거
- `test/earn.test.js`: 배송비 있음/없음, 버림, O-1042 테스트 추가
- `docs/knowledge/points/`: 적립 규정과 저장된 적립값 규칙 기록
- 범위 밖: 이미 저장된 `points.earned`, 영수증 형식, 적립률 값, 선물하기 적립(`src/gift/gift-points.js`), 환불 회수(`src/orders/refund.js:34`)

## 테스트
- `npm test`: 24개 통과
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
