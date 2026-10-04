# fix: 적립 예정 포인트를 배송비 제외, 쿠폰·포인트 차감 후 상품 금액 버림으로 계산

## 요약
주문의 적립 예정 포인트가 적립 안내보다 많게 나오던 문제를 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비를 포함한 결제 금액(`amounts.total`)에 반올림 `percentOf`를 적용했다.

## 변경
- `src/points/earn.js`: 기준을 `goods - coupon - pointsUsed`로, 계산을 버림으로 변경
- `src/money.js`: 버림 도우미 `floorPercentOf` 추가 (`percentOf`는 환불·선물하기가 쓰므로 그대로)
- `docs/knowledge/points/earn-basis.md`: 적립 기준과 아직 따르지 않는 곳 기록
- 변경하지 않음: `src/format/`, `src/gift/gift-points.js`, 이미 저장된 `points.earned`

## 테스트
- `npm test`: 22 pass, 0 fail (재현 테스트 2개 추가)
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
- 알려진 한계: 부분 환불 포인트 회수(`src/orders/refund.js:34`)는 옛 기준 그대로
