# fix: 적립 포인트를 배송비 제외, 원 단위 버림 기준으로 맞춘다

## 요약
적립 포인트가 고객센터 기준보다 많게 나오던 문제를 고친다. 기준 금액은 상품 − 쿠폰 − 사용 포인트(배송비 제외)이고 1%를 원 단위로 버림한다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비가 든 결제액(`amounts.total`)에 반올림(`percentOf`)을 적용했다. 선물 적립(`gift-points.js`)도 같은 식이었고, 환불 회수(`refund.js`)는 환불 상품 금액에 반올림을 적용해 주문 적립과 기준이 달랐다.

## 변경
- `src/money.js`: 버림 도우미 `floorPercentOf` 추가
- `src/points/earn.js`: `earnBase`, `pointsForBase`, `earnPoints`로 새 기준 계산
- `src/gift/gift-points.js`: `earnPoints`를 그대로 사용
- `src/orders/refund.js`: 부분 환불 회수 = 환불 전 적립 − 환불 후 적립(나눠 환불해도 합이 전체 적립과 같다)
- `docs/knowledge/points/`: 적립 기준 규칙과 부분 환불 회수 방식 기록
- 적립률, 포인트 사용, 쿠폰·배송비 계산과 과거 주문 소급은 바꾸지 않았다.

## 테스트
- `npm test`: 27개 통과
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- 새 `test/earn.test.js`는 기준 커밋 src에서 5개 실패, 수정 후 통과
- 남은 위험: 옛 기준으로 저장된 과거 주문을 부분 환불하면 회수 값이 저장 적립과 어긋날 수 있다.
