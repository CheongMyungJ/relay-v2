# fix: 적립 포인트 기준에서 배송비를 빼고 소수점을 버린다

## 요약
일반 주문의 적립 예정 포인트가 안내 규정과 달라서 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 결제 금액(`amounts.total`, 배송비 포함)에 반올림을 적용했다. 배송비 3,000원이 기준에 들어가고 소수점이 반올림됐다(26,770원 × 1% = 267.7 → 268).

## 변경
- `src/points/earn.js`: 기준 금액을 `상품 금액 − 쿠폰 − 사용 포인트`로 하고 소수점을 버린다.
- `src/orders/refund.js`: 부분 환불 회수 포인트도 같은 기준으로 맞춤(쿠폰·사용 포인트를 환불 상품 금액 비율로 나눠 뺀 금액의 1%, 버림). 나눠 환불해도 회수 합계가 적립액을 넘지 않는다.
- `src/money.js`: `floorPercentOf` 추가. `percentOf`는 선물하기가 쓰므로 그대로 둔다.
- `docs/knowledge/points/earn-basis.md`: 적립 기준 규칙과 미정 사항 기록.
- 비목표: 선물하기 적립, 적립률 값.

## 테스트
- `npm test`: 26건 통과(`test/refund-points.test.js` 3건 포함)
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
- `test/earn.test.js` 3건 추가(배송비 제외, 소수점 버림, O-1042). 수정 전 코드에서는 3건 모두 실패
